import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    type IPendingSessionInvitation,
    type ISessionRoster,
    OPEN_SESSION_PHASES,
    type TSessionParticipationResult,
} from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';
import { assertActive } from '../../clubs/access/club-access.js';
import { recordNotification } from '../../notifications/notification-store.js';
import { Transactions } from '../../notifications/transactions.js';
import {
    assertManager,
    assertOpen,
    assertRemovable,
    getOwnStatus,
    predatesMembership,
} from '../session-access.js';
import { lockSessionForMember } from '../session-lock.js';
import { recordRosterChange } from './session-departure.js';
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
    ): Promise<TSessionParticipationResult> {
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
                await tx.sessionParticipant.upsert({
                    where: { sessionId_membershipId: { sessionId, membershipId: membership.id } },
                    create: {
                        sessionId,
                        clubId: session.clubId,
                        membershipId: membership.id,
                        status,
                    },
                    update: { status },
                });
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
}
