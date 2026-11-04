import type { TSessionNominationAuthors } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TMembership } from '../../clubs/access/club-access.js';
import type { MoviesService } from '../../movies/movies.service.js';
import { canViewNominationAuthors } from '../session-visibility.js';
import { selectionScoresSnapshotSchema } from './selection-result.js';

/** Authors can be visible independently of Selection totals and named scores. */
export async function loadNominationAuthors(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    membership: TMembership,
    moviesService: MoviesService,
): Promise<TSessionNominationAuthors | null> {
    if (
        session.type === 'PRE_SELECTED' ||
        !canViewNominationAuthors(session, membership.club) ||
        (session.phase !== 'WATCHING' &&
            session.phase !== 'RATING' &&
            session.phase !== 'COMPLETED')
    )
        return null;
    const rows =
        session.type === 'PAST'
            ? await readPastAuthors(tx, session.id)
            : await readLiveAuthors(tx, session);
    const movies = await moviesService.findSummaries(
        tx,
        rows.map((row) => row.movieId),
    );
    return rows.map(({ id, movieId, author }) => ({
        nominationId: id,
        movie: movies.get(movieId)!,
        author,
    }));
}

async function readPastAuthors(tx: Prisma.TransactionClient, sessionId: string) {
    const rows = await tx.pastNomination.findMany({
        where: { sessionId },
        orderBy: { movieId: 'asc' },
        select: {
            id: true,
            movieId: true,
            nominator: { select: { user: { select: { displayName: true } } } },
        },
    });
    return rows.map((row) => ({
        id: row.id,
        movieId: row.movieId,
        author: row.nominator?.user.displayName ?? null,
    }));
}

async function readLiveAuthors(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
) {
    const frozen =
        session.selectionResult === null
            ? null
            : selectionScoresSnapshotSchema.parse(session.selectionResult).inputs.nominations;
    const nominations = await tx.nomination.findMany({
        where: {
            sessionId: session.id,
            ...(frozen ? { id: { in: frozen.map((row) => row.id) } } : { isInSelection: true }),
        },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        select: {
            id: true,
            movieId: true,
            participant: {
                select: { membership: { select: { user: { select: { displayName: true } } } } },
            },
        },
    });
    const frozenMovies = new Map(frozen?.map((row) => [row.id, row.movieId]));
    return nominations.map((row) => ({
        id: row.id,
        movieId: frozen ? frozenMovies.get(row.id)! : row.movieId,
        author: row.participant.membership.user.displayName,
    }));
}
