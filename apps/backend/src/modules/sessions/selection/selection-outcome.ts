import { selectionReasonSchema, type TSelectionOutcome } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';
import { z } from 'zod';

import type { TMembership } from '../../clubs/access/club-access.js';
import { getClubEntitlements } from '../../clubs/access/club-tiers.js';
import type { MoviesService } from '../../movies/movies.service.js';

// Read the stored JSON boundary once; never return its ballots, recipients or provider IDs.
const snapshotSchema = z.object({
    movieId: z.uuid(),
    winnerNominationId: z.uuid(),
    closedAt: z.iso.datetime(),
    closure: z.object({ kind: z.enum(['AUTOMATIC', 'MANUAL']) }),
    reason: selectionReasonSchema,
    inputs: z.object({
        scaleMin: z.union([z.literal(0), z.literal(1)]),
        scaleMax: z.int(),
        ballots: z.array(z.object({})),
    }),
    ranking: z.array(
        z.object({
            id: z.uuid(),
            movieId: z.uuid(),
            total: z.int(),
            maximumCount: z.int(),
            supporterCount: z.int(),
        }),
    ),
});

export async function loadSelectionOutcome(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    membership: TMembership,
    moviesService: MoviesService,
): Promise<TSelectionOutcome | null> {
    if (session.selectionResult === null) return null;
    const saved = snapshotSchema.parse(session.selectionResult);
    const canSeeBreakdown =
        membership.role !== 'MEMBER' ||
        (getClubEntitlements(session.clubId).voteResultVisibility === 'ADMIN_CONFIGURABLE' &&
            session.showVoteResults);
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
