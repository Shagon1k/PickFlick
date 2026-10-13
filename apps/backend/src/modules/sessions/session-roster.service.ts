import { randomBytes } from 'node:crypto';

import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type {
    ICreatedInvitation,
    IPendingSessionInvitation,
    ISessionRoster,
    TSessionInvitationPreview,
} from '@pickflick/contracts';

import { PrismaService } from '../../database/prisma.service.js';
import { lockClub } from '../clubs/club-access.js';
import { lockSession, lockSessionForMember } from './session-lock.js';
import {
    assertManager,
    assertOpen,
    canManage,
    digest,
    inviteInclude,
    preview,
    revokePending,
    rosterAudit,
} from './session-roster-access.js';
import { readRoster } from './session-roster-projection.js';

@Injectable()
export class SessionRosterService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string, sessionId: string): Promise<ISessionRoster> {
        return this.prisma.$transaction((tx) => readRoster(tx, userId, sessionId), {
            isolationLevel: 'RepeatableRead',
        });
    }

    async create(
        userId: string,
        sessionId: string,
        membershipId: string,
    ): Promise<ICreatedInvitation> {
        return this.prisma.$transaction(async (tx) => {
            const { session, member } = await lockSessionForMember(tx, userId, sessionId);
            if (member.role === 'MEMBER') throw new ForbiddenException();
            assertOpen(session.phase);
            if (!(await canManage(tx, member)))
                throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
            const target = await tx.membership.findFirst({
                where: {
                    id: membershipId,
                    clubId: session.clubId,
                    status: 'ACTIVE',
                    user: { status: 'ACTIVE' },
                },
            });
            if (!target) throw new ConflictException({ reason: 'MEMBERSHIP_INELIGIBLE' });
            const existing = await tx.sessionParticipant.findUnique({
                where: { sessionId_membershipId: { sessionId, membershipId } },
            });
            if (existing?.status === 'ACCEPTED')
                throw new ConflictException({ reason: 'ALREADY_PARTICIPATING' });
            const participant = await tx.sessionParticipant.upsert({
                where: { sessionId_membershipId: { sessionId, membershipId } },
                create: { sessionId, membershipId, clubId: session.clubId },
                update: { status: 'INVITED' },
            });
            await revokePending(tx, participant.id);
            const token = randomBytes(32).toString('base64url');
            const invitation = await tx.sessionInvite.create({
                data: {
                    tokenDigest: digest(token),
                    participantId: participant.id,
                    clubId: session.clubId,
                    inviterMembershipId: member.id,
                    expiresAt: new Date(Date.now() + 7 * 86400_000),
                },
            });
            await rosterAudit(
                tx,
                userId,
                target.userId,
                membershipId,
                session.clubId,
                sessionId,
                'SESSION_INVITE_CREATED',
            );
            return { id: invitation.id, token, expiresAt: invitation.expiresAt.toISOString() };
        });
    }

    async revoke(userId: string, sessionId: string, inviteId: string) {
        await this.prisma.$transaction(async (tx) => {
            const { session, member } = await lockSessionForMember(tx, userId, sessionId);
            assertManager(member, session.phase);
            const invite = await tx.sessionInvite.findFirst({
                where: { id: inviteId, participant: { sessionId } },
                include: inviteInclude,
            });
            if (!invite) throw new NotFoundException();
            if (invite.revokedAt || invite.respondedAt) return;
            await tx.sessionInvite.update({
                where: { id: inviteId },
                data: { revokedAt: new Date() },
            });
            await rosterAudit(
                tx,
                userId,
                invite.participant.membership.userId,
                invite.participant.membershipId,
                session.clubId,
                sessionId,
                'SESSION_INVITE_REVOKED',
            );
        });
    }

    async depart(
        userId: string,
        sessionId: string,
        input: { confirmation: 'LEAVE' } | { confirmation: 'REMOVE'; participantId: string },
    ) {
        await this.prisma.$transaction(async (tx) => {
            const { session, member } = await lockSessionForMember(tx, userId, sessionId);
            assertOpen(session.phase);
            const removing = input.confirmation === 'REMOVE';
            if (removing) assertManager(member, session.phase);
            const participant = await tx.sessionParticipant.findFirst({
                where: removing
                    ? { id: input.participantId, sessionId }
                    : { membershipId: member.id, sessionId },
                include: { membership: true },
            });
            if (!participant) throw new NotFoundException();
            if (removing && participant.membershipId === member.id)
                throw new ConflictException({ reason: 'USE_LEAVE' });
            const status = removing ? 'REMOVED' : 'LEFT';
            if (participant.status === status) return;
            if (
                participant.status !== 'ACCEPTED' &&
                !(removing && participant.status === 'INVITED')
            )
                throw new ConflictException({ reason: 'NOT_PARTICIPATING' });
            await tx.sessionParticipant.update({ where: { id: participant.id }, data: { status } });
            await revokePending(tx, participant.id);
            await rosterAudit(
                tx,
                userId,
                participant.membership.userId,
                participant.membershipId,
                session.clubId,
                sessionId,
                removing ? 'SESSION_PARTICIPANT_REMOVED' : 'SESSION_PARTICIPANT_LEFT',
            );
        });
    }

    async preview(userId: string, token: string): Promise<TSessionInvitationPreview> {
        return this.prisma.$transaction(
            async (tx) =>
                preview(
                    await tx.sessionInvite.findUnique({
                        where: { tokenDigest: digest(token) },
                        include: inviteInclude,
                    }),
                    userId,
                ),
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async pending(userId: string): Promise<IPendingSessionInvitation[]> {
        return this.prisma.$transaction(
            async (tx) => {
                const invites = await tx.sessionInvite.findMany({
                    where: {
                        participant: { membership: { userId } },
                        respondedAt: null,
                        revokedAt: null,
                        expiresAt: { gt: new Date() },
                    },
                    include: inviteInclude,
                    orderBy: { createdAt: 'desc' },
                });
                return invites.flatMap((invite) => {
                    const view = preview(invite, userId);
                    return view.state === 'valid'
                        ? [
                              {
                                  id: invite.id,
                                  clubName: view.clubName,
                                  topic: view.topic,
                                  inviterName: view.inviterName,
                                  expiresAt: view.expiresAt,
                              },
                          ]
                        : [];
                });
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async respond(
        userId: string,
        selector: { token: string } | { id: string },
        decision: 'accept' | 'decline',
    ): Promise<TSessionInvitationPreview> {
        return this.prisma.$transaction(async (tx) => {
            const where =
                'token' in selector ? { tokenDigest: digest(selector.token) } : { id: selector.id };
            const found = await tx.sessionInvite.findUnique({
                where,
                include: { participant: true },
            });
            if (!found) return { state: 'unavailable' };
            await lockClub(tx, found.clubId);
            await lockSession(tx, found.participant.sessionId);
            const invite = await tx.sessionInvite.findUniqueOrThrow({
                where,
                include: inviteInclude,
            });
            const view = preview(invite, userId);
            if (view.state !== 'valid') return view;
            const accepted = decision === 'accept';
            await tx.sessionInvite.update({
                where: { id: invite.id },
                data: { respondedAt: new Date(), accepted },
            });
            await tx.sessionParticipant.update({
                where: { id: invite.participantId },
                data: { status: accepted ? 'ACCEPTED' : 'DECLINED' },
            });
            await rosterAudit(
                tx,
                userId,
                userId,
                invite.participant.membershipId,
                invite.clubId,
                invite.participant.sessionId,
                'SESSION_INVITE_RESPONDED',
            );
            return accepted
                ? {
                      state: 'accepted',
                      sessionId: invite.participant.sessionId,
                      clubId: invite.clubId,
                  }
                : { state: 'declined' };
        });
    }
}
