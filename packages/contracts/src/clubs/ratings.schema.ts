import { z } from 'zod';

export const CLUB_RATINGS_PAGE_SIZE = 25;

export const clubRatingsQuerySchema = z.strictObject({
    sort: z.enum(['rating', 'time', 'title']).default('rating'),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
});
export type TClubRatingsQuery = z.infer<typeof clubRatingsQuerySchema>;

export const clubRatingsSchema = z.object({
    analytics: z.enum(['BASIC', 'EXTENDED']),
    items: z
        .array(
            z.object({
                movieId: z.uuid(),
                title: z.string().nullable(),
                year: z.number().int().nullable(),
                genres: z.array(z.string()),
                averageRating: z.number(),
            }),
        )
        .max(CLUB_RATINGS_PAGE_SIZE),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pages: z.number().int().positive(),
    pageSize: z.literal(CLUB_RATINGS_PAGE_SIZE),
});
export type TClubRatings = z.infer<typeof clubRatingsSchema>;
