import type { Prisma } from '@pickflick/database';

export function readCompletedScreenings(tx: Prisma.TransactionClient, clubId: string) {
    return tx.session.findMany({
        where: { clubId, phase: 'COMPLETED' },
        orderBy: { id: 'asc' },
        select: {
            movieId: true,
            scheduledAt: true,
            movie: { select: { id: true, title: true, releaseYear: true } },
            ratings: {
                where: {
                    session: {
                        club: { showRatingsAfter: true },
                    },
                },
                select: { score: true },
            },
        },
    });
}

export type TCompletedScreening = Awaited<ReturnType<typeof readCompletedScreenings>>[number];
