import { z } from 'zod';

export const RATINGS_CSV_MAX_BYTES = 512 * 1024;
export const RATINGS_CSV_MAX_ROWS = 1000;
export const RATINGS_CSV_MAX_CELL_LENGTH = 2048;
export const RATINGS_CSV_HEADER = 'version,movie_id,name,rating';

export const ratingsCsvRecordSchema = z.tuple([
    z.literal('1', { error: 'Unsupported version. Use version 1.' }),
    z.uuid({ error: 'Use a valid canonical Movie UUID from a PickFlick export.' }),
    z.string().max(RATINGS_CSV_MAX_CELL_LENGTH),
    z.string().regex(/^(?:[1-9]|10)$/u, { error: 'Rating must be a whole number from 1 to 10.' }),
]);

const ratingsCsvRowSchema = z.strictObject({
    row: z.number().int().min(2),
    movieId: z.uuid(),
    name: z.string(),
    rating: z.number().int().min(1).max(10),
    currentRating: z.number().nullable(),
    action: z.enum(['create', 'update', 'unchanged']),
});

export const ratingsCsvResultSchema = z.strictObject({
    total: z.number().int().nonnegative(),
    rows: z.array(ratingsCsvRowSchema),
    errors: z.array(z.strictObject({ row: z.number().int().positive(), message: z.string() })),
    imported: z.boolean(),
});
export type TRatingsCsvResult = z.infer<typeof ratingsCsvResultSchema>;

export const ratingsCsvExportSchema = z.strictObject({
    csv: z.string(),
    count: z.number().int().nonnegative(),
});
export type TRatingsCsvExport = z.infer<typeof ratingsCsvExportSchema>;
