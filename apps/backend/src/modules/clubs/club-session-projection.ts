import {
    getPosterPath,
    type IClubHubParticipant,
    type IClubHubSession,
} from '@pickflick/contracts';
import { Prisma } from '@pickflick/database';

import { canJoinSession, getOwnStatus } from '../sessions/session-access.js';
import { canViewCompletedRatings } from '../sessions/session-visibility.js';
import type { TMembership } from './access/club-access.js';

export const sessionInclude = {
    movie: { select: { id: true, title: true, releaseYear: true } },
    _count: {
        select: {
            participants: { where: { status: 'ACCEPTED' } },
            nominations: {
                where: { OR: [{ participant: { status: 'ACCEPTED' } }, { isInSelection: true }] },
            },
            selectionBallots: { where: { participant: { status: 'ACCEPTED' } } },
            ratings: { where: { participant: { status: 'ACCEPTED' } } },
        },
    },
} satisfies Prisma.SessionInclude;

type THubSessionRow = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

/** Reads what every listed Session card needs beyond its own row, then maps rows to cards. */
export async function createHubSessionProjection(
    tx: Prisma.TransactionClient,
    membership: TMembership,
    rows: THubSessionRow[],
) {
    const ids = [...new Set(rows.map(({ id }) => id))];
    const visibleRatingIds = rows
        .filter((row) => row.phase === 'COMPLETED' && canViewCompletedRatings(row, membership.role))
        .map((row) => row.id);
    const ratingIds = rows.filter((row) => row.phase === 'RATING').map((row) => row.id);
    const [ordinalById, own, averages, participants] = await Promise.all([
        readOrdinals(tx, membership.club.id, ids),
        tx.sessionParticipant.findMany({
            where: { membership: { userId: membership.userId }, sessionId: { in: ids } },
            select: { sessionId: true, membershipId: true, status: true },
        }),
        tx.sessionRating.groupBy({
            by: ['sessionId'],
            where: { sessionId: { in: visibleRatingIds } },
            _avg: { score: true },
        }),
        tx.sessionParticipant.findMany({
            where: { sessionId: { in: ratingIds }, status: 'ACCEPTED' },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                sessionId: true,
                membership: { select: { user: { select: { displayName: true, image: true } } } },
            },
        }),
    ]);
    const averageById = new Map(averages.map((row) => [row.sessionId, row._avg.score]));
    const participantsBySession = new Map<string, IClubHubParticipant[]>();
    for (const participant of participants) {
        const summaries = participantsBySession.get(participant.sessionId) ?? [];
        const user = participant.membership.user;
        summaries.push({
            id: participant.id,
            displayName: user.displayName,
            avatarUrl: user.image
                ? `/api/clubs/${membership.club.id}/sessions/${participant.sessionId}/participants/${participant.id}/avatar`
                : null,
        });
        participantsBySession.set(participant.sessionId, summaries);
    }
    return (row: THubSessionRow): IClubHubSession => ({
        id: row.id,
        ordinal: ordinalById.get(row.id)!,
        phase: row.phase,
        ...(row.topic ? { topic: row.topic } : {}),
        ...(row.location ? { location: row.location } : {}),
        ...(row.scheduledAt ? { scheduledAt: row.scheduledAt.toISOString() } : {}),
        updatedAt: row.updatedAt.toISOString(),
        ...(row.phase === 'RATING'
            ? { participants: participantsBySession.get(row.id) ?? [] }
            : {}),
        acceptedCount: row._count.participants,
        nominatedCount: row._count.nominations,
        progressCount: getProgressCount(row),
        ratingAverage: averageById.get(row.id) ?? null,
        canJoin: canJoinSession(
            row,
            membership,
            getOwnStatus(
                own.filter(({ sessionId }) => sessionId === row.id),
                membership.id,
            ),
        ),
        movie: row.movie
            ? {
                  id: row.movie.id,
                  title: row.movie.title,
                  year: row.movie.releaseYear,
                  runtime: null,
                  genres: [],
                  posterUrl: getPosterPath(row.movie.id),
              }
            : null,
    });
}

/** A Session's number counts every Session the Club created, so cancellation never renumbers. */
async function readOrdinals(tx: Prisma.TransactionClient, clubId: string, ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await tx.$queryRaw<{ id: string; ordinal: bigint }[]>`
        SELECT id, ordinal FROM (
            SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS ordinal
            FROM "Session" WHERE "clubId" = ${clubId}::uuid
        ) numbered WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    `;
    return new Map(rows.map((row) => [row.id, Number(row.ordinal)]));
}

function getProgressCount(row: THubSessionRow) {
    if (row.phase === 'NOMINATION') return row._count.nominations;
    if (row.phase === 'SELECTION') return row._count.selectionBallots;
    if (row.phase === 'RATING') return row._count.ratings;
    return null;
}
