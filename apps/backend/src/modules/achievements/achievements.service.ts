import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import type { TAchievement, TAchievements } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { findMembership, lockClub } from '../clubs/access/club-access.js';
import { buildDetailsCacheKey } from '../movies/catalog-cache-key.js';
import {
    ACHIEVEMENT_DEFINITIONS,
    type IAchievementDefinition,
    PRIVATE_CLUB_CRITERIA,
} from './achievement-definitions.js';
import type { IAchievementMetric } from './achievement-metrics.js';
import { readAchievementSessions } from './achievement-sources.js';
import { buildClubAchievements } from './club-achievements.js';
import { buildPersonalAchievements } from './personal-achievements.js';

@Injectable()
export class AchievementsService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async listClub(userId: string, clubId: string): Promise<TAchievements> {
        return this.prisma.$transaction(async (tx) => {
            await lockClub(tx, clubId);
            const member = await findMembership(tx, userId, clubId);
            const metrics = buildClubAchievements(
                await readAchievementSessions(tx, [clubId], this.getCacheKey()),
            );
            const items = await this.recompute(tx, { scope: 'CLUB', subjectId: clubId, metrics });
            return {
                items: items.map((item) =>
                    member.role === 'MEMBER' && PRIVATE_CLUB_CRITERIA.has(item.key)
                        ? {
                              ...item,
                              progress: null,
                              status: 'not-started',
                              awardedAt: null,
                              explanation:
                                  'Result-based Club achievements are visible to Admins and Moderators only. Their progress and award history are private.',
                          }
                        : item,
                ),
            };
        });
    }

    async listPersonal(userId: string): Promise<TAchievements> {
        return this.prisma.$transaction(async (tx) => {
            // Recomputations for one owner serialize before reading source data and prior awards.
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
            const user = await tx.user.findUniqueOrThrow({
                where: { id: userId },
                select: { displayName: true, image: true },
            });
            const memberships = await tx.membership.findMany({
                where: { userId, club: { deletedAt: null } },
                select: { clubId: true },
            });
            const [sessions, ratings, watchlist, invites] = await Promise.all([
                readAchievementSessions(
                    tx,
                    [...new Set(memberships.map((member) => member.clubId))],
                    this.getCacheKey(),
                ),
                tx.personalMovieRating.findMany({ where: { userId }, select: { movieId: true } }),
                tx.watchlistItem.findMany({ where: { userId }, select: { movieId: true } }),
                tx.clubInvite.findMany({
                    where: { inviterId: userId, accepted: true, responderId: { not: userId } },
                    select: { id: true },
                }),
            ]);
            const metrics = buildPersonalAchievements({
                userId,
                sessions,
                hasProfile: Boolean(user.displayName.trim() && user.image),
                libraryMovieIds: [...ratings, ...watchlist].map((row) => row.movieId),
                acceptedInviteIds: invites.map((invite) => invite.id),
            });
            return {
                items: await this.recompute(tx, { scope: 'PERSONAL', subjectId: userId, metrics }),
            };
        });
    }

    private getCacheKey() {
        return buildDetailsCacheKey(
            this.environment.catalog.provider,
            this.environment.catalog.locale,
        );
    }

    private async recompute(
        tx: Prisma.TransactionClient,
        input: {
            scope: IAchievementDefinition['scope'];
            subjectId: string;
            metrics: Record<string, IAchievementMetric>;
        },
    ): Promise<TAchievement[]> {
        const definitions = ACHIEVEMENT_DEFINITIONS.filter(
            (definition) => definition.scope === input.scope,
        );
        await tx.achievementDefinition.createMany({ data: definitions, skipDuplicates: true });
        const storedDefinitions = await tx.achievementDefinition.findMany({
            where: { scope: input.scope },
        });
        for (const definition of definitions) {
            const stored = storedDefinitions.find(
                (row) => row.key === definition.key && row.version === definition.version,
            )!;
            if (
                stored.target !== definition.target ||
                stored.title !== definition.title ||
                stored.description !== definition.description
            ) {
                throw new Error('Achievement definition changed without a new rule version.');
            }
            const metric = input.metrics[definition.key]!;
            const existing = await tx.achievementAward.findUnique({
                where: {
                    scope_key_version_subjectId: {
                        scope: input.scope,
                        key: definition.key,
                        version: definition.version,
                        subjectId: input.subjectId,
                    },
                },
            });
            if (existing?.awardedAt) continue;
            const data = {
                progress: metric.value,
                explanation: metric.explanation,
                evidence: metric.evidence,
                computedAt: new Date(),
                awardedAt:
                    metric.value !== null && metric.value >= definition.target ? new Date() : null,
            };
            await tx.achievementAward.upsert({
                where: {
                    scope_key_version_subjectId: {
                        scope: input.scope,
                        key: definition.key,
                        version: definition.version,
                        subjectId: input.subjectId,
                    },
                },
                create: {
                    ...data,
                    scope: input.scope,
                    key: definition.key,
                    version: definition.version,
                    subjectId: input.subjectId,
                    userId: input.scope === 'PERSONAL' ? input.subjectId : null,
                    clubId: input.scope === 'CLUB' ? input.subjectId : null,
                },
                update: data,
            });
        }
        const rows = await tx.achievementAward.findMany({
            where: { scope: input.scope, subjectId: input.subjectId },
            include: { definition: true },
            orderBy: [{ key: 'asc' }, { version: 'asc' }],
        });
        return rows
            .filter(
                (row) =>
                    row.awardedAt ||
                    definitions.some(
                        (definition) =>
                            definition.key === row.key && definition.version === row.version,
                    ),
            )
            .map((row) => {
                const pendingStatus = row.progress ? 'in-progress' : 'not-started';
                return {
                    key: row.key,
                    version: row.version,
                    title: row.definition.title,
                    description: row.definition.description,
                    target: row.definition.target,
                    progress: row.progress,
                    status: row.awardedAt ? 'unlocked' : pendingStatus,
                    awardedAt: row.awardedAt?.toISOString() ?? null,
                    explanation: row.explanation,
                };
            });
    }
}
