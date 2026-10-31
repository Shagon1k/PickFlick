import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    type IPendingSessionInvitation,
    type ISessionRoster,
    OPEN_SESSION_PHASES,
    type TSessionInvitationPreview,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { digestInviteToken } from '../../../common/invite-token.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
    assertActive,
    lockClub,
    recordAudit,
    type TAuditEvent,
} from '../../clubs/access/club-access.js';
import { recordNotification } from '../../notifications/notification-store.js';
import { Transactions } from '../../notifications/transactions.js';
import {
    assertManager,
    assertOpen,
    assertRemovable,
    getOwnStatus,
    predatesMembership,
} from '../session-access.js';
import { completeSessionPhase } from '../session-completion.js';
import { lockSession, lockSessionForMember } from '../session-lock.js';
import { inviteInclude, revokePendingInvites, toInvitationPreview } from './session-invites.js';
import { readRoster } from './session-roster-projection.js';

@Injectable()
export class SessionRosterService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactions: Transactions,
    ) {}

    async get(userId: string, sessionId: string): Promise<ISessionRoster> {
        return this.transactions.read((tx) => readRoster(tx, userId, sessionId), {
            isolationLevel: 'RepeatableRead',
        });
    }

    async participate(
        userId: string,
        sessionId: string,
        decision: 'accept' | 'decline',
    ): Promise<TSessionInvitationPreview> {
        return this.transactions.write(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, sessionId);
            assertOpen(session.phase);
            assertActive(membership);
            const own = await tx.sessionParticipant.findMany({
                where: { sessionId, membership: { userId } },
            });
            const existing = own.find((row) => row.membershipId === membership.id);
            if (existing?.status === 'ACCEPTED')
                return { state: 'accepted', sessionId, clubId: session.clubId };
            // Removed, or already counted under a Membership from before the member rejoined.
            const ownStatus = getOwnStatus(own, membership.id);
            if (
                ownStatus === 'REMOVED' ||
                ownStatus === 'ACCEPTED' ||
                (decision === 'accept' && predatesMembership(session, membership.joinedAt))
            )
                throw new ConflictException({ reason: 'MEMBERSHIP_INELIGIBLE' });
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

    async revoke(userId: string, sessionId: string, inviteId: string) {
        await this.transactions.write(async (tx) => {
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
        await this.transactions.write(async (tx) => {
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
            if (isRemoving) assertRemovable(membership, participant.membership);
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
            // Club removal also departs Sessions, but that is announced once, as MEMBERSHIP_REMOVED.
            if (isRemoving)
                await recordNotification(tx, {
                    recipientId: participant.membership.userId,
                    event: 'SESSION_PARTICIPANT_REMOVED',
                    sourceId: participant.id,
                    clubId: session.clubId,
                    sessionId,
                });
        });
    }

    async preview(userId: string, token: string): Promise<TSessionInvitationPreview> {
        return this.transactions.read(
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
            include: {
                club: {
                    include: {
                        memberships: {
                            where: { userId, status: 'ACTIVE' },
                            select: { joinedAt: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return sessions
            .filter(
                (session) => !predatesMembership(session, session.club.memberships[0]!.joinedAt),
            )
            .map((session) => ({
                id: session.id,
                clubName: session.club.name,
                topic: session.topic,
                scheduledAt: session.scheduledAt?.toISOString() ?? null,
            }));
    }

    async respond(
        userId: string,
        token: string,
        decision: 'accept' | 'decline',
    ): Promise<TSessionInvitationPreview> {
        return this.transactions.write(async (tx) => {
            const where = { tokenDigest: digestInviteToken(token) };
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
