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

/** Keep this transaction open through the phase decision; roster writes lock the same Session. */
export async function readSessionRoster(database: Prisma.TransactionClient, sessionId: string) {
    await database.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const session = await database.session.findUniqueOrThrow({
        where: { id: sessionId },
        select: {
            phase: true,
            phaseVersion: true,
            rosterVersion: true,
            participants: {
                where: { status: 'ACCEPTED' },
                orderBy: { id: 'asc' },
                select: { id: true, membershipId: true },
            },
        },
    });
    return { ...session, denominator: session.participants.length };
}
