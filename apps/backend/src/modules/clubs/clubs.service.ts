import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import {
    BLOCKING_SESSION_PHASES,
    type IClubHub,
    type IClubHubSession,
    type IClubSettings,
    type IClubSummary,
    type TChangeMemberRoleRequest,
    type TCreateClubRequest,
    type TUpdateClubSettingsRequest,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { lockKey } from '../../database/advisory-lock.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
    assertActive,
    assertAdmin,
    clubAccess,
    findMembership,
    loadClubAccess,
    lockClub,
    recordAudit,
} from './access/club-access.js';
import { canRemoveMember, clubPermissions } from './access/club-permissions.js';
import { clubEntitlements, tierEntitlements } from './access/club-tiers.js';
import { toClubSummary } from './club.mapper.js';

@Injectable()
export class ClubsService {
    constructor(private readonly prisma: PrismaService) {}

    async list(userId: string): Promise<IClubSummary[]> {
        const memberships = await this.prisma.membership.findMany({
            where: { userId, status: 'ACTIVE', club: { deletedAt: null } },
            orderBy: [{ club: { updatedAt: 'desc' } }, { joinedAt: 'asc' }],
            select: { role: true, club: true },
        });
        return memberships.map(({ club, role }) => toClubSummary(club, role));
    }

    async getHub(userId: string, clubId: string): Promise<IClubHub> {
        return this.prisma.$transaction(
            async (transaction) => {
                const membership = await findMembership(transaction, userId, clubId);
                const [
                    { access, memberCount },
                    sessionCount,
                    completedSessionCount,
                    blockingSession,
                    recent,
                    ratings,
                    history,
                ] = await Promise.all([
                    loadClubAccess(transaction, membership.club),
                    transaction.session.count({
                        where: { clubId, phase: { not: 'CANCELLED' } },
                    }),
                    transaction.session.count({ where: { clubId, phase: 'COMPLETED' } }),
                    transaction.session.findFirst({
                        where: {
                            clubId,
                            phase: { in: [...BLOCKING_SESSION_PHASES] },
                        },
                        orderBy: { createdAt: 'desc' },
                    }),
                    transaction.session.findMany({
                        where: { clubId, phase: { not: 'CANCELLED' } },
                        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                        take: 5,
                    }),
                    transaction.session.findMany({
                        where: { clubId, phase: 'RATING' },
                        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                    }),
                    transaction.session.findMany({
                        where: { clubId, phase: { in: ['COMPLETED', 'CANCELLED'] } },
                        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                        take: 20,
                    }),
                ]);
                const activeSession = blockingSession ?? ratings[0];
                return {
                    club: toClubSummary(membership.club, membership.role),
                    memberCount,
                    access,
                    permissions: clubPermissions(
                        membership.role,
                        membership.club.lifecycle,
                        access,
                    ),
                    sessionCount,
                    completedSessionCount,
                    ...(activeSession ? { activeSession: toHubSession(activeSession) } : {}),
                    recentSessions: recent.map(toHubSession),
                    ratingSessions: ratings.map(toHubSession),
                    historySessions: history.map(toHubSession),
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async create(userId: string, input: TCreateClubRequest): Promise<IClubSummary> {
        const { adminClubLimit } = tierEntitlements('FREE');
        return this.prisma.$transaction(async (transaction) => {
            await lockKey(transaction, `club-admin:${userId}`);
            await assertBelowAdminLimit(transaction, userId, adminClubLimit);
            const club = await transaction.club.create({
                data: {
                    id: randomUUID(),
                    ...input,
                    memberships: { create: { id: randomUUID(), userId, role: 'ADMIN' } },
                },
            });
            return toClubSummary(club, 'ADMIN');
        });
    }

    async getSettings(userId: string, clubId: string): Promise<IClubSettings> {
        return this.prisma.$transaction(
            async (transaction) => {
                const membership = await findMembership(transaction, userId, clubId);
                const { club, role } = membership;
                const [members, auditEvents] = await Promise.all([
                    transaction.membership.findMany({
                        where: { clubId, status: 'ACTIVE' },
                        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
                        select: {
                            id: true,
                            role: true,
                            joinedAt: true,
                            user: { select: { displayName: true } },
                        },
                    }),
                    role === 'ADMIN'
                        ? transaction.clubAuditEvent.findMany({
                              where: { clubId },
                              orderBy: { createdAt: 'desc' },
                              take: 20,
                              select: { id: true, action: true, createdAt: true },
                          })
                        : [],
                ]);

                const access = clubAccess(
                    club.lifecycle,
                    members.some((member) => member.role === 'ADMIN'),
                    members.length,
                    clubEntitlements(clubId).memberLimit,
                );
                return {
                    access,
                    currentMembershipId: membership.id,
                    club: toClubSummary(club, role),
                    permissions: clubPermissions(role, club.lifecycle, access),
                    entitlements: clubEntitlements(clubId),
                    visibility: {
                        showNominationAuthors: club.showNominationAuthors,
                        showNominationsBeforeSubmit: club.showNominationsBeforeSubmit,
                        showVoteResults: club.showVoteResults,
                        showRatingResults: club.showRatingResults,
                        useMonochromeMedia: club.useMonochromeMedia,
                    },
                    members: members.map((member) => ({
                        id: member.id,
                        displayName: member.user.displayName,
                        role: member.role,
                        joinedAt: member.joinedAt.toISOString(),
                        canRemove: canRemoveMember(membership, member, club.lifecycle),
                    })),
                    auditEvents: auditEvents.map((event) => ({
                        ...event,
                        createdAt: event.createdAt.toISOString(),
                    })),
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async updateSettings(
        userId: string,
        clubId: string,
        input: TUpdateClubSettingsRequest,
    ): Promise<IClubSettings> {
        await this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const membership = await findMembership(transaction, userId, clubId);
            assertAdmin(membership);
            assertActive(membership);
            if (
                input.showVoteResults &&
                clubEntitlements(clubId).voteResultVisibility !== 'ADMIN_CONFIGURABLE'
            ) {
                throw new ConflictException({ reason: 'TIER_SETTING_UNAVAILABLE' });
            }
            await transaction.club.update({
                where: { id: clubId },
                data: { ...input, description: input.description ?? null },
            });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'CLUB_SETTINGS_UPDATED',
            });
        });
        return this.getSettings(userId, clubId);
    }

    async changeMemberRole(
        userId: string,
        clubId: string,
        membershipId: string,
        { role }: TChangeMemberRoleRequest,
    ): Promise<void> {
        await this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const membership = await findMembership(transaction, userId, clubId);
            assertAdmin(membership);
            assertActive(membership);
            const target = await transaction.membership.findFirst({
                where: { id: membershipId, clubId, status: 'ACTIVE' },
                select: { id: true, role: true, userId: true },
            });
            if (!target || target.role === 'ADMIN') {
                throw new ConflictException({ reason: 'MEMBERSHIP_INELIGIBLE' });
            }
            if (target.role === role) {
                return;
            }
            await transaction.membership.update({ where: { id: target.id }, data: { role } });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: target.userId,
                subjectMembershipId: target.id,
                action: 'MEMBERSHIP_ROLE_CHANGED',
                previousRole: target.role,
                nextRole: role,
            });
        });
    }
}

function toHubSession(session: {
    id: string;
    phase: IClubHubSession['phase'];
    topic: string | null;
    location: string | null;
    scheduledAt: Date | null;
    updatedAt: Date;
}): IClubHubSession {
    return {
        id: session.id,
        phase: session.phase,
        ...(session.topic ? { topic: session.topic } : {}),
        ...(session.location ? { location: session.location } : {}),
        ...(session.scheduledAt ? { scheduledAt: session.scheduledAt.toISOString() } : {}),
        updatedAt: session.updatedAt.toISOString(),
    };
}

/** Free Admins may run one active Club; the lock makes concurrent creations count each other. */
export async function assertBelowAdminLimit(
    transaction: Prisma.TransactionClient,
    userId: string,
    limit: number,
): Promise<void> {
    const administered = await transaction.membership.count({
        where: {
            userId,
            role: 'ADMIN',
            status: 'ACTIVE',
            club: { lifecycle: 'ACTIVE', deletedAt: null },
        },
    });
    if (administered >= limit) {
        throw new ConflictException({ reason: 'ADMIN_CLUB_LIMIT_REACHED' });
    }
}
