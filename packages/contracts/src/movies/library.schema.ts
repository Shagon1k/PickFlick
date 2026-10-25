import { z } from 'zod';

import { movieIdSchema } from './movie.schema.js';
import { personalMovieRatingSchema } from './personal-rating.schema.js';
import { watchlistItemSchema, watchlistPrioritySchema } from './watchlist.schema.js';

export const LIBRARY_PAGE_SIZE = 25;
export const LIBRARY_SEARCH_MAX_LENGTH = 200;

export const libraryQuerySchema = z.strictObject({
    tab: z.enum(['my-ratings', 'watchlist']).default('my-ratings'),
    q: z.string().trim().max(LIBRARY_SEARCH_MAX_LENGTH).default(''),
    score: z.enum(['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']).default(''),
    priority: z.union([z.literal(''), watchlistPrioritySchema]).default(''),
    sort: z.enum(['default', 'title', 'year', 'recent']).default('default'),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
});
export type TLibraryQuery = z.infer<typeof libraryQuerySchema>;

const movie = z.object({
    movieId: movieIdSchema,
    title: z.string().nullable(),
    releaseYear: z.number().int().nullable(),
    genres: z.array(z.string()),
});
const pagination = z.object({
    page: z.number().int().positive(),
    pages: z.number().int().positive(),
    pageSize: z.literal(LIBRARY_PAGE_SIZE),
    total: z.number().int().nonnegative(),
});
export const librarySchema = z.discriminatedUnion('tab', [
    pagination.extend({
        tab: z.literal('my-ratings'),
        items: z.array(movie.extend(personalMovieRatingSchema.shape)).max(LIBRARY_PAGE_SIZE),
    }),
    pagination.extend({
        tab: z.literal('watchlist'),
        items: z.array(movie.extend(watchlistItemSchema.shape)).max(LIBRARY_PAGE_SIZE),
    }),
]);
export type TLibrary = z.infer<typeof librarySchema>;
