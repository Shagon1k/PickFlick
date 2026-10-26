import type { TClubRole } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

export function readCompletedScreenings(
    tx: Prisma.TransactionClient,
    clubId: string,
    role: TClubRole,
) {
    return tx.session.findMany({
        where: { clubId, phase: 'COMPLETED' },
        orderBy: { id: 'asc' },
        select: {
            movieId: true,
            scheduledAt: true,
            movie: { select: { id: true, title: true, releaseYear: true } },
            ratings: {
                where: role === 'MEMBER' ? { session: { showRatingResults: true } } : {},
                select: { score: true },
            },
        },
    });
}

export type TCompletedScreening = Awaited<ReturnType<typeof readCompletedScreenings>>[number];
