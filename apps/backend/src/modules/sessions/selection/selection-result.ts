import { selectionReasonSchema, selectionScaleMinSchema } from '@pickflick/contracts';
import { z } from 'zod';

/** The frozen Selection result stored on the Session when Selection closes. */
// Read the stored JSON boundary once; never return its ballots, recipients or provider IDs.
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
