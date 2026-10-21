import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    type ICreatedInvitation,
    type IPendingSessionInvitation,
    type ISessionRoster,
    OPEN_SESSION_PHASES,
    type TSessionInvitationPreview,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { createInviteToken, digestInviteToken } from '../../../common/invite-token.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { lockClub, recordAudit, type TAuditEvent } from '../../clubs/access/club-access.js';
import { assertManager, assertOpen } from '../session-access.js';
import { completeSessionPhase } from '../session-completion.js';
import { lockSession, lockSessionForMember } from '../session-lock.js';
import { inviteInclude, revokePendingInvites, toInvitationPreview } from './session-invites.js';
import { readRoster } from './session-roster-projection.js';

@Injectable()
export class SessionRosterService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string, sessionId: string): Promise<ISessionRoster> {
        return this.prisma.$transaction((tx) => readRoster(tx, userId, sessionId), {
            isolationLevel: 'RepeatableRead',
        });
    }

    async participate(
        userId: string,
        sessionId: string,
        decision: 'accept' | 'decline',
    ): Promise<TSessionInvitationPreview> {
        return this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, sessionId);
            assertOpen(session.phase);
            if (membership.club.lifecycle !== 'ACTIVE')
                throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
            const existing = await tx.sessionParticipant.findUnique({
                where: { sessionId_membershipId: { sessionId, membershipId: membership.id } },
            });
            if (existing?.status === 'REMOVED')
                throw new ConflictException({ reason: 'MEMBERSHIP_INELIGIBLE' });
            if (existing?.status === 'ACCEPTED')
                return { state: 'accepted', sessionId, clubId: session.clubId };
            const status = decision === 'accept' ? 'ACCEPTED' : 'DECLINED';
            if (existing?.status !== status) {
                const participant = await tx.sessionParticipant.upsert({
                    where: { sessionId_membershipId: { sessionId, membershipId: membership.id } },
                    create: {
                        sessionId,
                        clubId: session.clubId,
                        membershipId: membership.id,
                        status,
                    },
                    update: { status },
                });
                await revokePendingInvites(tx, participant.id);
                await recordRosterChange(tx, {
                    actorUserId: userId,
                    subjectUserId: userId,
                    subjectMembershipId: membership.id,
                    clubId: session.clubId,
                    sessionId,
                    action: 'SESSION_INVITE_RESPONDED',
                });
            }
            return decision === 'accept'
                ? { state: 'accepted', sessionId, clubId: session.clubId }
                : { state: 'declined' };
        });
    }

    async create(
        userId: string,
        sessionId: string,
        membershipId: string,
    ): Promise<ICreatedInvitation> {
        return this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, sessionId);
            assertOpen(session.phase);
            await assertManager(tx, membership);
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
            await revokePendingInvites(tx, participant.id);
            const { token, tokenDigest, expiresAt } = createInviteToken();
            const invitation = await tx.sessionInvite.create({
                data: {
                    tokenDigest,
                    participantId: participant.id,
                    clubId: session.clubId,
                    inviterMembershipId: membership.id,
                    expiresAt,
                },
            });
            await recordRosterChange(tx, {
                actorUserId: userId,
                subjectUserId: target.userId,
                subjectMembershipId: membershipId,
                clubId: session.clubId,
                sessionId,
                action: 'SESSION_INVITE_CREATED',
            });
            return { id: invitation.id, token, expiresAt: invitation.expiresAt.toISOString() };
        });
    }

    async revoke(userId: string, sessionId: string, inviteId: string) {
        await this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, sessionId);
            assertOpen(session.phase);
            await assertManager(tx, membership);
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
            await recordRosterChange(tx, {
                actorUserId: userId,
                subjectUserId: invite.participant.membership.userId,
                subjectMembershipId: invite.participant.membershipId,
                clubId: session.clubId,
                sessionId,
                action: 'SESSION_INVITE_REVOKED',
            });
        });
    }

    async depart(
        userId: string,
        sessionId: string,
        input: { confirmation: 'LEAVE' } | { confirmation: 'REMOVE'; participantId: string },
    ) {
        await this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, sessionId);
            assertOpen(session.phase);
            const isRemoving = input.confirmation === 'REMOVE';
            if (isRemoving) await assertManager(tx, membership);
            const participant = await tx.sessionParticipant.findFirst({
                where: isRemoving
                    ? { id: input.participantId, sessionId }
                    : { membershipId: membership.id, sessionId },
                include: { membership: true },
            });
            if (!participant) throw new NotFoundException();
            if (isRemoving && participant.membershipId === membership.id)
                throw new ConflictException({ reason: 'USE_LEAVE' });
            const status = isRemoving ? 'REMOVED' : 'LEFT';
            if (participant.status === status) return;
            if (
                participant.status !== 'ACCEPTED' &&
                !(isRemoving && participant.status === 'INVITED')
            )
                throw new ConflictException({ reason: 'NOT_PARTICIPATING' });
            await tx.sessionParticipant.update({ where: { id: participant.id }, data: { status } });
            await revokePendingInvites(tx, participant.id);
            await recordRosterChange(tx, {
                actorUserId: userId,
                subjectUserId: participant.membership.userId,
                subjectMembershipId: participant.membershipId,
                clubId: session.clubId,
                sessionId,
                action: isRemoving ? 'SESSION_PARTICIPANT_REMOVED' : 'SESSION_PARTICIPANT_LEFT',
            });
        });
    }

    async preview(userId: string, token: string): Promise<TSessionInvitationPreview> {
        return this.prisma.$transaction(
            async (tx) =>
                toInvitationPreview(
                    await tx.sessionInvite.findUnique({
                        where: { tokenDigest: digestInviteToken(token) },
                        include: inviteInclude,
                    }),
                    userId,
                ),
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async listPending(userId: string): Promise<IPendingSessionInvitation[]> {
        const sessions = await this.prisma.session.findMany({
            where: {
                phase: { in: [...OPEN_SESSION_PHASES] },
                club: {
                    deletedAt: null,
                    lifecycle: 'ACTIVE',
                    memberships: { some: { userId, status: 'ACTIVE', user: { status: 'ACTIVE' } } },
                },
                participants: {
                    none: {
                        membership: { userId, status: 'ACTIVE' },
                        status: { in: ['ACCEPTED', 'DECLINED', 'LEFT', 'REMOVED'] },
                    },
                },
            },
            include: { club: true },
            orderBy: { createdAt: 'desc' },
        });
        return sessions.map((session) => ({
            id: session.id,
            clubName: session.club.name,
            topic: session.topic,
            scheduledAt: session.scheduledAt?.toISOString() ?? null,
        }));
    }

    async respond(
        userId: string,
        selector: { token: string } | { id: string },
        decision: 'accept' | 'decline',
    ): Promise<TSessionInvitationPreview> {
        return this.prisma.$transaction(async (tx) => {
            const where =
                'token' in selector
                    ? { tokenDigest: digestInviteToken(selector.token) }
                    : { id: selector.id };
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
            const view = toInvitationPreview(invite, userId);
            if (view.state !== 'valid') return view;
            const isAccepted = decision === 'accept';
            await tx.sessionInvite.update({
                where: { id: invite.id },
                data: { respondedAt: new Date(), accepted: isAccepted },
            });
            await tx.sessionParticipant.update({
                where: { id: invite.participantId },
                data: { status: isAccepted ? 'ACCEPTED' : 'DECLINED' },
            });
            await recordRosterChange(tx, {
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: invite.participant.membershipId,
                clubId: invite.clubId,
                sessionId: invite.participant.sessionId,
                action: 'SESSION_INVITE_RESPONDED',
            });
            return isAccepted
                ? {
                      state: 'accepted',
                      sessionId: invite.participant.sessionId,
                      clubId: invite.clubId,
                  }
                : { state: 'declined' };
        });
    }
}

/** Records a roster event, then re-checks whether the current phase is complete. */
async function recordRosterChange(
    tx: Prisma.TransactionClient,
    event: TAuditEvent & { sessionId: string },
) {
    await recordAudit(tx, event);
    await completeSessionPhase(tx, event.sessionId);
}
