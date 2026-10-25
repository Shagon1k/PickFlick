import { z } from 'zod';

import { nominationMovieSchema } from './nomination.schema.js';

export const pastSelectionSchema = z.strictObject({
    scaleMin: z.union([z.literal(0), z.literal(1)]),
    scaleMax: z.int().min(1).max(10),
    nominations: z
        .array(
            z.strictObject({
                movie: nominationMovieSchema,
                scoreCount: z.int().nonnegative(),
                total: z.int().nonnegative().nullable(),
            }),
        )
        .nullable(),
});
export type TPastSelection = z.infer<typeof pastSelectionSchema>;
