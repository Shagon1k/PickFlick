import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import {
    getPosterPath,
    type IClubHub,
    type IClubSettings,
    type IClubSummary,
    type TChangeMemberRoleRequest,
    type TCreateClubRequest,
    type TMovieDetails,
    type TUpdateClubSettingsRequest,
} from '@pickflick/contracts';

import { lockKey } from '../../database/advisory-lock.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MoviesService } from '../movies/movies.service.js';
import { Transactions } from '../notifications/transactions.js';
import {
    assertActive,
    assertAdmin,
    assertBelowAdminLimit,
    findMembership,
    getClubAccess,
    lockClub,
    recordAudit,
} from './access/club-access.js';
import { getClubPermissions } from './access/club-permissions.js';
import { getClubEntitlements } from './access/club-tiers.js';
import { toClubSummary } from './club.mapper.js';
import { readClubHub } from './club-hub.js';
import { findActiveMembers, toClubMember } from './club-members.js';
import { buildClubStatistics } from './statistics/club-statistics.js';

@Injectable()
export class ClubsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactions: Transactions,
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
        const { hub: snapshot, completed } = await this.transactions.read(
            (tx) => readClubHub(tx, userId, clubId),
            { isolationLevel: 'RepeatableRead' },
        );
        const completedIds = completed.flatMap((row) => (row.movieId ? [row.movieId] : []));
        const hub: IClubHub = {
            ...snapshot,
            statistics: buildClubStatistics(
                completed,
                snapshot.club.tier === 'PRO'
                    ? await this.movies.getCachedMetadata(completedIds)
                    : new Map<string, TMovieDetails>(),
                snapshot.club.tier,
            ),
        };
        const selected = hub.activeSession?.movie;
        if (selected) {
            const details = await this.movies.getDetails(selected.id, { allowStale: true });
            if (details.state !== 'unavailable') {
                selected.title = details.data.title ?? selected.title;
                selected.runtime = details.data.runtime;
                selected.genres = details.data.genres ?? [];
                selected.posterUrl = details.data.posterUrl ? getPosterPath(selected.id) : null;
            }
        }
        return hub;
    }

    async create(userId: string, input: TCreateClubRequest): Promise<IClubSummary> {
        return this.transactions.write(async (transaction) => {
            await lockKey(transaction, `club-admin:${userId}`);
            await assertBelowAdminLimit(transaction, userId);
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
        return this.transactions.read(
            async (transaction) => {
                const membership = await findMembership(transaction, userId, clubId);
                const { club, role } = membership;
                const members = await findActiveMembers(transaction, clubId);

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
                    members: members.map((member) => toClubMember(membership, member)),
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
        await this.transactions.write(async (transaction) => {
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
        await this.transactions.write(async (transaction) => {
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
