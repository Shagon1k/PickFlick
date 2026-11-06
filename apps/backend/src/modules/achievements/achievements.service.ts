import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import type { TAchievement, TAchievements } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { findMembership } from '../clubs/access/club-access.js';
import { buildConfiguredDetailsKey } from '../movies/catalog-cache-key.js';
import { recordAchievementNotifications } from '../notifications/notification-producers.js';
import { Transactions } from '../notifications/transactions.js';
import { buildClubAchievements } from './rules/club-rules.js';
import { buildPersonalAchievements } from './rules/personal-rules.js';
import { hiddenResultAchievementKeys } from './rules/result-visibility.js';
import { ACHIEVEMENT_DEFINITIONS, type IAchievementDefinition } from './rules/rule-catalog.js';
import { readAchievementSessions } from './rules/rule-sources.js';

@Injectable()
export class AchievementsService {
    constructor(
        private readonly transactions: Transactions,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async listClub(userId: string, clubId: string): Promise<TAchievements> {
        return this.transactions.write(async (tx) => {
            const member = await findMembership(tx, userId, clubId);
            const sessions = await readAchievementSessions(tx, [clubId], this.getCacheKey());
            const facts = buildClubAchievements(sessions);
            return {
                items: await this.recompute(tx, {
                    scope: 'CLUB',
                    subjectId: clubId,
                    hidePrivate: member.role === 'MEMBER',
                    hiddenPrivateKeys: hiddenResultAchievementKeys(member.club),
                    ...facts,
                }),
            };
        });
    }

    // shortcut: each view rereads the member's whole history to evaluate goals. Fine for personal
    // and Club histories of hundreds of Sessions; keep running totals if views slow down.
    async listPersonal(userId: string): Promise<TAchievements> {
        return this.transactions.write(async (tx) => {
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
        return buildConfiguredDetailsKey(this.environment.catalog);
    }

    /** Awards every goal the current facts reach, then lists earned and pending cards. */
    private async recompute(tx: Prisma.TransactionClient, input: IRecomputeInput) {
        const definitions = ACHIEVEMENT_DEFINITIONS.filter(
            (definition) => definition.scope === input.scope,
        );
        const owner =
            input.scope === 'PERSONAL' ? { userId: input.subjectId } : { clubId: input.subjectId };
        await this.awardReachedGoals(tx, definitions, owner, input);
        const earned = await tx.achievementAward.findMany({ where: owner });
        return toAchievementCards(definitions, earned, input);
    }

    // Each key/version is earned once per owner; skipDuplicates keeps earlier awards untouched.
    private async awardReachedGoals(
        tx: Prisma.TransactionClient,
        definitions: IAchievementDefinition[],
        owner: { userId: string } | { clubId: string },
        input: IRecomputeInput,
    ) {
        const created = await tx.achievementAward.createManyAndReturn({
            data: definitions
                .filter((definition) => getProgress(input, definition) >= definition.target)
                .map((definition) => ({
                    ...owner,
                    key: definition.key,
                    version: definition.version,
                    title: definition.title,
                    description: definition.description,
                    explanation: definition.explanation,
                    target: definition.target,
                    private: definition.private ?? false,
                    progress: getProgress(input, definition),
                    evidence: input.evidence,
                })),
            skipDuplicates: true,
        });
        // No one is told about an award whose results the Club hides; the notification resolver
        // also hides older notifications once a Club turns those results off.
        await recordAchievementNotifications(
            tx,
            created.filter((award) => !input.hiddenPrivateKeys?.includes(award.key)),
        );
    }
}

interface IRecomputeInput {
    scope: IAchievementDefinition['scope'];
    hidePrivate?: boolean;
    hiddenPrivateKeys?: string[];
    subjectId: string;
    metrics: Record<string, number>;
    evidence: Prisma.InputJsonObject;
}

function getProgress(input: IRecomputeInput, definition: IAchievementDefinition) {
    return input.metrics[definition.key] ?? 0;
}

const PRIVATE_EXPLANATION =
    'Result-based Club achievements are visible to Admins and Moderators only. Their progress and award history are private.';

const HIDDEN_RESULTS_EXPLANATION =
    'This achievement depends on Session results hidden by the Club’s visibility settings. Its progress and award history are private.';

/** Why a private achievement stays hidden from this viewer, or null when they may see it. */
function getHiddenExplanation(input: IRecomputeInput, award: { key: string; private?: boolean }) {
    if (!award.private) return null;
    if (input.hiddenPrivateKeys?.includes(award.key)) return HIDDEN_RESULTS_EXPLANATION;
    return input.hidePrivate ? PRIVATE_EXPLANATION : null;
}

/** Earned cards keep their snapshot; current definitions add pending or private placeholders. */
function toAchievementCards(
    definitions: IAchievementDefinition[],
    earned: Prisma.AchievementAwardGetPayload<object>[],
    input: IRecomputeInput,
): TAchievement[] {
    const visibleAwards = earned.filter((award) => getHiddenExplanation(input, award) === null);
    const cards: TAchievement[] = visibleAwards.map((award) => ({
        key: award.key,
        version: award.version,
        title: award.title,
        description: award.description,
        explanation: award.explanation,
        target: award.target,
        progress: award.progress,
        status: 'unlocked',
        awardedAt: award.awardedAt.toISOString(),
    }));
    for (const definition of definitions) {
        const { key, version, title, description, target } = definition;
        const hiddenExplanation = getHiddenExplanation(input, definition);
        if (hiddenExplanation) {
            cards.push({
                ...{ key, version, title, description, target },
                progress: null,
                status: 'not-started',
                awardedAt: null,
                explanation: hiddenExplanation,
            });
            continue;
        }
        const isEarned = visibleAwards.some(
            (award) => award.key === key && award.version === version,
        );
        if (isEarned) continue;
        const progress = getProgress(input, definition);
        cards.push({
            ...{ key, version, title, description, target },
            explanation: definition.explanation,
            progress,
            status: progress ? 'in-progress' : 'not-started',
            awardedAt: null,
        });
    }
    return cards.sort((a, b) => a.key.localeCompare(b.key) || a.version - b.version);
}
