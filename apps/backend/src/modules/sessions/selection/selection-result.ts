import { selectionReasonSchema, selectionScaleMinSchema } from '@pickflick/contracts';
import { z } from 'zod';

/** The frozen Selection result stored on the Session when Selection closes. */
// Projections whitelist authorized totals or named scores; raw metadata and provider IDs stay internal.
export const selectionResultSchema = z.object({
    movieId: z.uuid(),
    winnerNominationId: z.uuid(),
    closedAt: z.iso.datetime(),
    closure: z.object({ kind: z.enum(['AUTOMATIC', 'MANUAL']) }),
    reason: selectionReasonSchema,
    inputs: z.object({
        scaleMin: selectionScaleMinSchema,
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

/** Named disclosure reads only frozen scoring inputs; provider and closure metadata stay internal. */
export const selectionScoresSnapshotSchema = z.object({
    inputs: z.object({
        scaleMin: selectionScaleMinSchema,
        scaleMax: z.int(),
        nominations: z.array(z.object({ id: z.uuid(), movieId: z.uuid() })),
        ballots: z.array(
            z.object({
                participantId: z.uuid(),
                scores: z.array(z.object({ nominationId: z.uuid(), score: z.int() })),
            }),
        ),
    }),
});
