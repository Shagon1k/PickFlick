import type { TImportedSelectionOutcome } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TMembership } from '../../clubs/access/club-access.js';
import type { MoviesService } from '../../movies/movies.service.js';
import { canViewSelectionBreakdown } from '../session-access.js';

export async function loadPastSelection(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    membership: TMembership,
    moviesService: MoviesService,
): Promise<TImportedSelectionOutcome | null> {
    if (session.type !== 'PAST') return null;
    const canSeeBreakdown = canViewSelectionBreakdown(session, membership);
    const visible = canSeeBreakdown
        ? await tx.pastNomination.findMany({
              where: { sessionId: session.id },
              include: {
                  scores: { select: { score: true } },
                  nominator: { select: { user: { select: { displayName: true } } } },
              },
              orderBy: { movieId: 'asc' },
          })
        : [];
    const movies = await moviesService.findSummaries(
        tx,
        visible.map((row) => row.movieId),
    );
    return {
        source: 'IMPORTED',
        scaleMin: session.selectionScaleMin === 0 ? 0 : 1,
        scaleMax: session.selectionScaleMax,
        nominations: canSeeBreakdown
            ? visible.map((row) => ({
                  movie: movies.get(row.movieId)!,
                  author: session.showNominationAuthors
                      ? (row.nominator?.user.displayName ?? null)
                      : null,
                  scoreCount: row.scores.length,
                  total: row.scores.length
                      ? row.scores.reduce((total, cell) => total + cell.score, 0)
                      : null,
              }))
            : null,
    };
}
