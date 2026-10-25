import type { TPastSelection } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TMembership } from '../../clubs/access/club-access.js';
import { getClubEntitlements } from '../../clubs/access/club-tiers.js';
import type { MoviesService } from '../../movies/movies.service.js';

export async function loadPastSelection(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    membership: TMembership,
    moviesService: MoviesService,
): Promise<TPastSelection | null> {
    if (session.type !== 'PAST') return null;
    const canSeeBreakdown =
        membership.role !== 'MEMBER' ||
        (getClubEntitlements(session.clubId).voteResultVisibility === 'ADMIN_CONFIGURABLE' &&
            session.showVoteResults);
    const visible = canSeeBreakdown
        ? await tx.pastNomination.findMany({
              where: { sessionId: session.id },
              include: { scores: { select: { score: true } } },
              orderBy: { movieId: 'asc' },
          })
        : [];
    const movies = await moviesService.findSummaries(
        tx,
        visible.map((row) => row.movieId),
    );
    return {
        scaleMin: session.selectionScaleMin === 0 ? 0 : 1,
        scaleMax: session.selectionScaleMax,
        nominations: canSeeBreakdown
            ? visible.map((row) => ({
                  movie: movies.get(row.movieId)!,
                  scoreCount: row.scores.length,
                  total: row.scores.length
                      ? row.scores.reduce((total, cell) => total + cell.score, 0)
                      : null,
              }))
            : null,
    };
}
