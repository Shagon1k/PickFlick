import type { Prisma } from '@pickflick/database';

import type { TClubAchievementKey } from './rule-catalog.js';

/** Result-derived awards must not reveal facts which even the Club's operators cannot read. */
export function hiddenResultAchievementKeys(
    sessions: {
        phase: string;
        showRatingsAfter: boolean | null;
        showSelectionScoresAfter: boolean | null;
    }[],
): TClubAchievementKey[] {
    const completed = sessions.filter((session) => session.phase === 'COMPLETED');
    return [
        ...(completed.some((session) => session.showRatingsAfter === false)
            ? (['critics-circle', 'cult-classic', 'shared-taste'] as const)
            : []),
        ...(completed.some((session) => session.showSelectionScoresAfter === false)
            ? (['perfect-split'] as const)
            : []),
    ];
}

export async function readHiddenResultAchievementKeys(
    tx: Prisma.TransactionClient,
    clubId: string,
) {
    return hiddenResultAchievementKeys(
        await tx.session.findMany({
            where: { clubId, phase: 'COMPLETED' },
            select: { phase: true, showRatingsAfter: true, showSelectionScoresAfter: true },
        }),
    );
}
