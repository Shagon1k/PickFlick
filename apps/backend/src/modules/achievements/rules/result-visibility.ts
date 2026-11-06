import type { IClubVisibility } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TClubAchievementKey } from './rule-catalog.js';

/** Named Selection results remain private even though Club rating averages are visible. */
export function hiddenResultAchievementKeys(
    club: Pick<IClubVisibility, 'showSelectionScoresAfter'>,
): TClubAchievementKey[] {
    return club.showSelectionScoresAfter ? [] : ['perfect-split'];
}

export async function readHiddenResultAchievementKeys(
    tx: Prisma.TransactionClient,
    clubId: string,
) {
    return hiddenResultAchievementKeys(
        await tx.club.findUniqueOrThrow({
            where: { id: clubId },
            select: { showSelectionScoresAfter: true },
        }),
    );
}
