import type { Prisma } from '@pickflick/database';

export async function readAchievementSessions(
    tx: Prisma.TransactionClient,
    clubIds: string[],
    cacheKey: string,
) {
    return tx.session.findMany({
        where: { clubId: { in: clubIds }, phase: { not: 'CANCELLED' } },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        select: {
            id: true,
            clubId: true,
            type: true,
            phase: true,
            scheduledAt: true,
            selectionResult: true,
            showRatingResults: true,
            club: {
                select: {
                    memberships: {
                        select: {
                            id: true,
                            userId: true,
                            joinedAt: true,
                            leftAt: true,
                            role: true,
                            status: true,
                        },
                    },
                },
            },
            participants: {
                select: {
                    id: true,
                    membershipId: true,
                    status: true,
                    attended: true,
                    membership: { select: { userId: true } },
                },
            },
            nominations: {
                select: {
                    id: true,
                    movieId: true,
                    participant: { select: { membership: { select: { userId: true } } } },
                    movie: {
                        select: { details: { where: { key: cacheKey }, select: { data: true } } },
                    },
                },
            },
            pastNominations: {
                select: {
                    id: true,
                    movieId: true,
                    nominator: { select: { userId: true } },
                    movie: {
                        select: { details: { where: { key: cacheKey }, select: { data: true } } },
                    },
                },
            },
            selectionBallots: { select: { id: true, participantId: true, submittedAt: true } },
            progressEvents: {
                where: { phase: 'SELECTION' },
                orderBy: { version: 'asc' },
                take: 1,
                select: { createdAt: true },
            },
            ratings: { select: { id: true, participantId: true, score: true, comment: true } },
            movie: {
                select: {
                    releaseYear: true,
                    details: { where: { key: cacheKey }, select: { data: true } },
                },
            },
        },
    });
}

export type TAchievementSession = Awaited<ReturnType<typeof readAchievementSessions>>[number];
