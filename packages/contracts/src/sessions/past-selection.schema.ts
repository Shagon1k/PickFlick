import { z } from 'zod';

import { nominationMovieSchema } from './nomination.schema.js';

export const importedSelectionOutcomeSchema = z.strictObject({
    source: z.literal('IMPORTED'),
    scaleMin: z.union([z.literal(0), z.literal(1)]),
    scaleMax: z.int().min(1).max(10),
    nominations: z
        .array(
            z.strictObject({
                movie: nominationMovieSchema,
                author: z.string().nullable(),
                scoreCount: z.int().nonnegative(),
                total: z.int().nonnegative().nullable(),
            }),
        )
        .nullable(),
});
export type TImportedSelectionOutcome = z.infer<typeof importedSelectionOutcomeSchema>;
