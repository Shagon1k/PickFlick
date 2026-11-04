import type { IClubVisibility } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TClubAchievementKey } from './rule-catalog.js';

/** Result-derived awards follow the Club's current disclosure rules, including stored awards. */
export function hiddenResultAchievementKeys(
    club: Pick<IClubVisibility, 'showRatingsAfter' | 'showSelectionScoresAfter'>,
): TClubAchievementKey[] {
    return [
        ...(!club.showRatingsAfter
            ? (['critics-circle', 'cult-classic', 'shared-taste'] as const)
            : []),
        ...(!club.showSelectionScoresAfter ? (['perfect-split'] as const) : []),
    ];
}

export async function readHiddenResultAchievementKeys(
    tx: Prisma.TransactionClient,
    clubId: string,
) {
    return hiddenResultAchievementKeys(
        await tx.club.findUniqueOrThrow({
            where: { id: clubId },
            select: { showRatingsAfter: true, showSelectionScoresAfter: true },
        }),
    );
}
