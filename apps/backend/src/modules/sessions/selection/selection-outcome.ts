import type { TLiveSelectionOutcome } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TMembership } from '../../clubs/access/club-access.js';
import type { MoviesService } from '../../movies/movies.service.js';
import { canViewSelectionBreakdown } from '../session-access.js';
import { selectionResultSchema } from './selection-result.js';

export async function loadSelectionOutcome(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    membership: TMembership,
    moviesService: MoviesService,
): Promise<TLiveSelectionOutcome | null> {
    if (session.selectionResult === null) return null;
    const saved = selectionResultSchema.parse(session.selectionResult);
    const canSeeBreakdown = canViewSelectionBreakdown(session, membership);
    const visible = canSeeBreakdown
        ? saved.ranking
        : saved.ranking.filter((row) => row.id === saved.winnerNominationId);
    const movies = await moviesService.findSummaries(
        tx,
        visible.map((row) => row.movieId),
    );
    const nominations = session.showNominationAuthors
        ? await tx.nomination.findMany({
              where: { sessionId: session.id, id: { in: visible.map((row) => row.id) } },
              select: {
                  id: true,
                  participant: {
                      select: {
                          membership: {
                              select: { user: { select: { displayName: true } } },
                          },
                      },
                  },
              },
          })
        : [];
    const authors = new Map(
        nominations.map((row) => [row.id, row.participant.membership.user.displayName]),
    );
    return {
        source: 'LIVE',
        winner: movies.get(saved.movieId)!,
        author: authors.get(saved.winnerNominationId) ?? null,
        closedAt: saved.closedAt,
        closure: saved.closure.kind,
        breakdown: canSeeBreakdown
            ? {
                  scaleMin: saved.inputs.scaleMin,
                  scaleMax: saved.inputs.scaleMax,
                  ballotCount: saved.inputs.ballots.length,
                  reason: saved.reason,
                  ranking: saved.ranking.map((row) => ({
                      id: row.id,
                      movie: movies.get(row.movieId)!,
                      author: authors.get(row.id) ?? null,
                      total: row.total,
                      maximumCount: row.maximumCount,
                      supporterCount: row.supporterCount,
                  })),
              }
            : null,
    };
}
