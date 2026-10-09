import { z } from 'zod';

export const tmdbIdSchema = z.number().int().positive().max(2_147_483_647);
export const movieSearchSchema = z.strictObject({
    query: z.string().trim().min(1).max(200),
    page: z.number().int().min(1).max(500).default(1),
});
export type TMovieSearch = z.infer<typeof movieSearchSchema>;

export const movieImagePathSchema = z
    .string()
    .regex(/^\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/u)
    .nullable();

export const movieSummarySchema = z.strictObject({
    tmdbId: tmdbIdSchema,
    title: z.string().min(1).max(1000),
    originalTitle: z.string().min(1).max(1000),
    overview: z.string().max(20_000),
    releaseDate: z.iso.date().nullable(),
    adult: z.boolean(),
    originalLanguage: z.string().max(10),
    posterPath: movieImagePathSchema,
    backdropPath: movieImagePathSchema,
    voteAverage: z.number().min(0).max(10),
    voteCount: z.number().int().nonnegative(),
});
export type TMovieSummary = z.infer<typeof movieSummarySchema>;

export const movieDetailsSchema = movieSummarySchema.extend({
    runtime: z.number().int().nonnegative().nullable(),
    genres: z.array(z.strictObject({ id: tmdbIdSchema, name: z.string().max(200) })),
    imdbId: z
        .string()
        .regex(/^tt\d{7,12}$/u)
        .nullable(),
    directors: z.array(z.strictObject({ id: tmdbIdSchema, name: z.string().max(1000) })),
    cast: z.array(
        z.strictObject({
            id: tmdbIdSchema,
            name: z.string().max(1000),
            character: z.string().max(1000),
            profilePath: movieImagePathSchema,
        }),
    ),
    trailers: z.array(
        z.strictObject({
            key: z.string().regex(/^[a-zA-Z0-9_-]{6,64}$/u),
            name: z.string().max(1000),
            site: z.literal('YouTube'),
            official: z.boolean(),
        }),
    ),
});
export type TMovieDetails = z.infer<typeof movieDetailsSchema>;

export const movieProviderReasonSchema = z.enum([
    'DISABLED',
    'TIMEOUT',
    'RATE_LIMITED',
    'UNAVAILABLE',
    'INVALID_RESPONSE',
    'NOT_FOUND',
    'AUTHENTICATION',
]);
export type TMovieProviderReason = z.infer<typeof movieProviderReasonSchema>;

export type TMovieResult<TData> =
    | { state: 'fresh'; data: TData; fetchedAt: string }
    | {
          state: 'stale';
          data: TData;
          fetchedAt: string;
          reason: TMovieProviderReason;
          retryAt?: string;
      }
    | { state: 'unavailable'; reason: TMovieProviderReason; retryAt?: string };

export const movieSearchResultsSchema = z.strictObject({
    movies: z.array(movieSummarySchema).max(100),
    page: z.number().int().min(1).max(500),
    totalPages: z.number().int().nonnegative(),
    totalResults: z.number().int().nonnegative(),
});
export type TMovieSearchResults = z.infer<typeof movieSearchResultsSchema>;
