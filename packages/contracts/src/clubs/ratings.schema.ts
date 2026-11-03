import { z } from 'zod';

import { createPaginationSchema } from '../common/pagination.js';

export const CLUB_RATINGS_PAGE_SIZE = 25;
export const CLUB_RATINGS_SEARCH_MAX_LENGTH = 200;

export const clubRatingsQuerySchema = z.strictObject({
    q: z.string().trim().max(CLUB_RATINGS_SEARCH_MAX_LENGTH).optional(),
    sort: z.enum(['rating', 'time', 'title', 'year', 'genre']).default('rating'),
    direction: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
});
export type TClubRatingsQuery = z.infer<typeof clubRatingsQuerySchema>;

export const clubRatingsSchema = createPaginationSchema(CLUB_RATINGS_PAGE_SIZE).extend({
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
});
export type TClubRatings = z.infer<typeof clubRatingsSchema>;
