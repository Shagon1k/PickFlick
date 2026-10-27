import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import type { TAchievement, TAchievements } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { findMembership } from '../clubs/access/club-access.js';
import { buildDetailsCacheKey } from '../movies/catalog-cache-key.js';
import { recordAchievementNotifications } from '../notifications/notification-producers.js';
import { buildClubAchievements } from './rules/club-rules.js';
import { buildPersonalAchievements } from './rules/personal-rules.js';
import { ACHIEVEMENT_DEFINITIONS, type IAchievementDefinition } from './rules/rule-catalog.js';
import { readAchievementSessions } from './rules/rule-sources.js';

@Injectable()
export class AchievementsService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async listClub(userId: string, clubId: string): Promise<TAchievements> {
        return this.prisma.$transaction(async (tx) => {
            const member = await findMembership(tx, userId, clubId);
            const facts = buildClubAchievements(
                await readAchievementSessions(tx, [clubId], this.getCacheKey()),
            );
            return {
                items: await this.recompute(tx, {
                    scope: 'CLUB',
                    subjectId: clubId,
                    hidePrivate: member.role === 'MEMBER',
                    ...facts,
                }),
            };
        });
    }

    async listPersonal(userId: string): Promise<TAchievements> {
        return this.prisma.$transaction(async (tx) => {
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
            const facts = buildPersonalAchievements({
                userId,
                sessions,
                hasProfile: Boolean(user.displayName.trim() && user.image),
                libraryMovieIds: [...ratings, ...watchlist].map((row) => row.movieId),
                acceptedInviteIds: invites.map((invite) => invite.id),
            });
            return {
                items: await this.recompute(tx, { scope: 'PERSONAL', subjectId: userId, ...facts }),
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
            hidePrivate?: boolean;
            subjectId: string;
            metrics: Record<string, number>;
            evidence: Prisma.InputJsonObject;
        },
    ): Promise<TAchievement[]> {
        const definitions = ACHIEVEMENT_DEFINITIONS.filter(
            (definition) => definition.scope === input.scope,
        );
        const owner =
            input.scope === 'PERSONAL' ? { userId: input.subjectId } : { clubId: input.subjectId };
        const created = await tx.achievementAward.createManyAndReturn({
            data: definitions
                .filter((definition) => input.metrics[definition.key]! >= definition.target)
                .map(
                    ({
                        key,
                        version,
                        title,
                        description,
                        explanation,
                        target,
                        private: isPrivate,
                    }) => ({
                        ...owner,
                        key,
                        version,
                        title,
                        description,
                        explanation,
                        target,
                        private: isPrivate ?? false,
                        progress: input.metrics[key]!,
                        evidence: input.evidence,
                    }),
                ),
            skipDuplicates: true,
        });
        await recordAchievementNotifications(tx, created);
        const rows = await tx.achievementAward.findMany({ where: owner });
        const visibleRows = rows.filter((row) => !input.hidePrivate || !row.private);
        const items: TAchievement[] = visibleRows.map((row) => ({
            key: row.key,
            version: row.version,
            title: row.title,
            description: row.description,
            explanation: row.explanation,
            target: row.target,
            progress: row.progress,
            status: 'unlocked',
            awardedAt: row.awardedAt.toISOString(),
        }));
        for (const definition of definitions) {
            if (input.hidePrivate && definition.private) {
                items.push({
                    key: definition.key,
                    version: definition.version,
                    title: definition.title,
                    description: definition.description,
                    target: definition.target,
                    progress: null,
                    status: 'not-started',
                    awardedAt: null,
                    explanation:
                        'Result-based Club achievements are visible to Admins and Moderators only. Their progress and award history are private.',
                });
                continue;
            }
            if (
                visibleRows.some(
                    (row) => row.key === definition.key && row.version === definition.version,
                )
            )
                continue;
            const progress = input.metrics[definition.key]!;
            items.push({
                key: definition.key,
                version: definition.version,
                title: definition.title,
                description: definition.description,
                explanation: definition.explanation,
                target: definition.target,
                progress,
                status: progress ? 'in-progress' : 'not-started',
                awardedAt: null,
            });
        }
        return items.sort((a, b) => a.key.localeCompare(b.key) || a.version - b.version);
    }
}
