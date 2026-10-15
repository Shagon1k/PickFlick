import { z } from 'zod';

import { CLUB_SELECTION_SCALE_CEILING } from '../clubs/club.schema.js';
import { nominationMovieSchema } from './nomination.schema.js';

const selectionScoreSchema = z.strictObject({
    nominationId: z.uuid(),
    score: z.int().min(0).max(CLUB_SELECTION_SCALE_CEILING),
});
export const submitSelectionSchema = z.strictObject({
    scores: z.array(selectionScoreSchema).min(1),
});
export type TSubmitSelection = z.infer<typeof submitSelectionSchema>;

export const selectionSchema = z.strictObject({
    scaleMin: z.union([z.literal(0), z.literal(1)]),
    scaleMax: z.int().min(1).max(CLUB_SELECTION_SCALE_CEILING),
    acceptedCount: z.int().nonnegative(),
    submittedCount: z.int().nonnegative(),
    canSubmit: z.boolean(),
    submittedAt: z.iso.datetime().nullable(),
    nominations: z.array(
        z.strictObject({
            id: z.uuid(),
            movie: nominationMovieSchema,
            author: z.string().nullable(),
            ownScore: z.int().nullable(),
        }),
    ),
});
export type TSelection = z.infer<typeof selectionSchema>;
