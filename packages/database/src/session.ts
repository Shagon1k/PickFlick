import type { Prisma } from './generated/prisma/client.js';

/** Call inside the creation transaction; Club settings writes share this row lock. */
export async function snapshotSessionSettings(database: Prisma.TransactionClient, clubId: string) {
    await database.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId}::uuid FOR UPDATE`;
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
