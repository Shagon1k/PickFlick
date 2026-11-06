import { z } from 'zod';

import { selectionScaleMaxSchema, selectionScaleMinSchema } from '../clubs/club.schema.js';
import { nominationMovieSchema } from './nomination.schema.js';

export const importedSelectionOutcomeSchema = z.strictObject({
    source: z.literal('IMPORTED'),
    scaleMin: selectionScaleMinSchema,
    scaleMax: selectionScaleMaxSchema,
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
