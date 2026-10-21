import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import {
    type IClubHub,
    type IClubSettings,
    type IClubSummary,
    type TChangeMemberRoleRequest,
    type TCreateClubRequest,
    type TUpdateClubSettingsRequest,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { lockKey } from '../../database/advisory-lock.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MoviesService } from '../movies/movies.service.js';
import {
    assertActive,
    assertAdmin,
    findMembership,
    getClubAccess,
    lockClub,
    recordAudit,
} from './access/club-access.js';
import { canRemoveMember, getClubPermissions } from './access/club-permissions.js';
import { getClubEntitlements, getTierEntitlements } from './access/club-tiers.js';
import { toClubSummary } from './club.mapper.js';
import { buildClubStatistics, readClubHub } from './club-hub.js';

const AUDIT_EVENTS_LIMIT = 20;

@Injectable()
export class ClubsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly movies: MoviesService,
    ) {}

    async list(userId: string): Promise<IClubSummary[]> {
        const memberships = await this.prisma.membership.findMany({
            where: { userId, status: 'ACTIVE', club: { deletedAt: null } },
            orderBy: [{ club: { updatedAt: 'desc' } }, { joinedAt: 'asc' }],
            select: { role: true, club: true },
        });
        return memberships.map(({ club, role }) => toClubSummary(club, role));
    }

    async getHub(userId: string, clubId: string): Promise<IClubHub> {
        const { hub, completed } = await this.prisma.$transaction(
            (tx) => readClubHub(tx, userId, clubId),
            { isolationLevel: 'RepeatableRead' },
        );
        const completedIds = completed.flatMap((row) => (row.movieId ? [row.movieId] : []));
        hub.statistics = buildClubStatistics(
            completed,
            await this.movies.getCachedMetadata(completedIds),
        );
        const selected = hub.activeSession?.movie;
        if (selected) {
            const details = await this.movies.getDetails(selected.id, { allowStale: true });
            if (details.state !== 'unavailable') {
                selected.title = details.data.title ?? selected.title;
                selected.runtime = details.data.runtime;
                selected.genres = details.data.genres ?? [];
                selected.posterUrl = details.data.posterUrl
                    ? `/api/movies/${selected.id}/poster`
                    : null;
            }
        }
        return hub;
    }

    async create(userId: string, input: TCreateClubRequest): Promise<IClubSummary> {
        const { adminClubLimit } = getTierEntitlements('FREE');
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
                            _count: {
                                select: {
                                    sessionParticipants: {
                                        where: {
                                            status: 'ACCEPTED',
                                            session: { phase: { not: 'CANCELLED' } },
                                        },
                                    },
                                },
                            },
                        },
                    }),
                    role === 'ADMIN'
                        ? transaction.clubAuditEvent.findMany({
                              where: { clubId },
                              orderBy: { createdAt: 'desc' },
                              take: AUDIT_EVENTS_LIMIT,
                              select: { id: true, action: true, createdAt: true },
                          })
                        : [],
                ]);

                const access = getClubAccess(
                    club.lifecycle,
                    members.some((member) => member.role === 'ADMIN'),
                    members.length,
                    getClubEntitlements(clubId).memberLimit,
                );
                return {
                    access,
                    currentMembershipId: membership.id,
                    club: toClubSummary(club, role),
                    permissions: getClubPermissions(role, club.lifecycle, access),
                    entitlements: getClubEntitlements(clubId),
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
                        sessionCount: member._count.sessionParticipants,
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
                getClubEntitlements(clubId).voteResultVisibility !== 'ADMIN_CONFIGURABLE'
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
