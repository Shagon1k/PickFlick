import type { Prisma } from './generated/prisma/client.js';
import { lockClub } from './locks.js';

/** Call inside the creation transaction; Club settings writes share this row lock. */
export async function snapshotSessionSettings(database: Prisma.TransactionClient, clubId: string) {
    await lockClub(database, clubId);
    return database.club.findUniqueOrThrow({
        where: { id: clubId },
        select: {
            selectionScaleMin: true,
            selectionScaleMax: true,
            showNominationAuthors: true,
            showNominationsBeforeSubmit: true,
            showVoteResults: true,
            showRatingResults: true,
            useMonochromeMedia: true,
        },
    });
}
