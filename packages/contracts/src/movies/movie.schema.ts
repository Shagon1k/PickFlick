import { z } from 'zod';

export const movieIdSchema = z.uuid();
export const tmdbIdSchema = z.number().int().positive().max(2_147_483_647);
export const movieSourceSchema = z.enum(['tmdb', 'poiskkino', 'thetvdb']);
export type TMovieSource = z.infer<typeof movieSourceSchema>;
export const movieExternalIdSchema = z
    .strictObject({
        source: z.enum(['tmdb', 'poiskkino', 'thetvdb', 'imdb']),
        externalId: z.string().regex(/^(?:[1-9]\d{0,15}|tt\d{7,12})$/u),
    })
    .refine(({ source, externalId }) =>
        source === 'imdb' ? /^tt\d{7,12}$/u.test(externalId) : /^[1-9]\d{0,15}$/u.test(externalId),
    );
export type TMovieExternalId = z.infer<typeof movieExternalIdSchema>;
export const MOVIE_QUERY_MAX_LENGTH = 200;
/** Providers send long casts; details keep the first fifty credits. */
export const MOVIE_CAST_LIMIT = 50;

export const movieSearchSchema = z.strictObject({
    query: z.string().trim().min(1).max(MOVIE_QUERY_MAX_LENGTH),
    page: z.number().int().min(1).max(500).default(1),
    locale: z.literal('en-US').default('en-US'),
});
export type TMovieSearch = z.infer<typeof movieSearchSchema>;

// Provider wire media stay private; browser responses use stored image paths.
export const movieImagePathSchema = z
    .string()
    .regex(/^\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/u)
    .nullable();
export const movieImageUrlSchema = z
    .url()
    .max(2048)
    .refine((value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.port &&
            !url.search &&
            !url.hash &&
            !/%(?:2f|5c|2e)/iu.test(value) &&
            [
                'image.tmdb.org',
                'image.openmoviedb.com',
                'st.kp.yandex.net',
                'avatars.mds.yandex.net',
                'artworks.thetvdb.com',
            ].includes(url.hostname) &&
            (/^\/[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp)$/u.test(url.pathname) ||
                (['image.openmoviedb.com', 'avatars.mds.yandex.net'].includes(url.hostname) &&
                    /^\/[a-zA-Z0-9_./-]+\/(?:orig|[1-9]\d{1,3}x[1-9]\d{1,3})$/u.test(url.pathname)))
        );
    });
export const movieTrailerUrlSchema = z
    .url()
    .max(2048)
    .refine((value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.port &&
            !url.hash &&
            ((['www.youtube.com', 'youtube.com'].includes(url.hostname) &&
                url.pathname === '/watch' &&
                [...url.searchParams.keys()].length === 1 &&
                /^[a-zA-Z0-9_-]{6,64}$/u.test(url.searchParams.get('v') ?? '')) ||
                (['www.youtube.com', 'youtube.com'].includes(url.hostname) &&
                    !url.search &&
                    /^\/embed\/[a-zA-Z0-9_-]{6,64}$/u.test(url.pathname)) ||
                (url.hostname === 'youtu.be' &&
                    !url.search &&
                    /^\/[a-zA-Z0-9_-]{6,64}$/u.test(url.pathname)))
        );
    });
export const movieProviderReasonSchema = z.enum([
    'DISABLED',
    'TIMEOUT',
    'RATE_LIMITED',
    'UNAVAILABLE',
    'INVALID_RESPONSE',
    'NOT_FOUND',
    'AUTHENTICATION',
    'IDENTITY_CONFLICT',
    'MISSING_EXTERNAL_ID',
]);
export type TMovieProviderReason = z.infer<typeof movieProviderReasonSchema>;
export const movieProvenanceSchema = z.strictObject({
    source: movieSourceSchema,
    fetchedAt: z.iso.datetime().nullable(),
    reason: movieProviderReasonSchema.nullable(),
    sections: z.array(z.enum(['metadata', 'media', 'ratings', 'similar'])),
});
export type TMovieProvenance = z.infer<typeof movieProvenanceSchema>;
const text = z.string().min(1).max(1000).nullable();
export const movieMetadataSchema = z.strictObject({
    title: text,
    originalTitle: text,
    overview: z.string().min(1).max(20_000).nullable(),
    releaseDate: z.iso.date().nullable(),
    releaseYear: z.number().int().min(1800).max(3000).nullable(),
    adult: z.boolean().nullable(),
    originalLanguage: z.string().min(2).max(10).nullable(),
    posterUrl: movieImageUrlSchema.nullable(),
    backdropUrl: movieImageUrlSchema.nullable(),
    ratings: z
        .array(
            z
                .strictObject({
                    source: z.string().min(1).max(50),
                    value: z.number().nonnegative(),
                    scale: z.number().positive(),
                    voteCount: z.number().int().nonnegative().nullable(),
                })
                .refine(({ value, scale }) => value <= scale),
        )
        .max(20),
    runtime: z.number().int().positive().nullable(),
    productionCountries: z
        .array(z.string().regex(/^[A-Z]{2,3}$/u))
        .max(250)
        .nullable()
        .default(null),
    genres: z.array(z.string().min(1).max(200)).max(100).nullable(),
    directors: z
        .array(z.strictObject({ name: z.string().min(1).max(1000) }))
        .max(100)
        .nullable(),
    writers: z
        .array(z.strictObject({ name: z.string().min(1).max(1000) }))
        .max(100)
        .nullable(),
    cast: z
        .array(
            z.strictObject({
                name: z.string().min(1).max(1000),
                character: text,
                profileUrl: movieImageUrlSchema.nullable(),
            }),
        )
        .max(MOVIE_CAST_LIMIT)
        .nullable(),
    trailers: z
        .array(
            z.strictObject({
                url: movieTrailerUrlSchema,
                name: text,
                official: z.boolean().nullable(),
            }),
        )
        .max(100)
        .nullable(),
    /** Whole US dollars; amounts in other currencies are left out rather than converted. */
    budget: z.number().int().nonnegative().nullable(),
    revenue: z.number().int().nonnegative().nullable(),
});
export type TMovieMetadata = z.infer<typeof movieMetadataSchema>;
export const movieSummarySchema = movieMetadataSchema
    .pick({
        title: true,
        originalTitle: true,
        overview: true,
        releaseDate: true,
        releaseYear: true,
        adult: true,
        originalLanguage: true,
        posterUrl: true,
        backdropUrl: true,
        ratings: true,
    })
    .extend({
        id: movieIdSchema,
        provenance: z.array(movieProvenanceSchema).max(3),
    });
export type TMovieSummary = z.infer<typeof movieSummarySchema>;
export const movieDetailsSchema = movieMetadataSchema.extend({
    id: movieIdSchema,
    provenance: z.array(movieProvenanceSchema).max(3),
    similarMovieIds: z.array(movieIdSchema).max(100).nullable(),
});
export type TMovieDetails = z.infer<typeof movieDetailsSchema>;
export type TMovieResult<TData> =
    | { state: 'fresh' | 'partial'; data: TData; fetchedAt: string }
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

export const movieStoredImageKeySchema = z.string().regex(/^[a-f0-9]{64}$/u);
const storedImageUrlSchema = z.string().regex(/^\/api\/movies\/images\/[a-f0-9]{64}$/u);
const publicDetailsSchema = movieDetailsSchema.extend({
    posterUrl: storedImageUrlSchema.nullable(),
    backdropUrl: storedImageUrlSchema.nullable(),
    cast: movieMetadataSchema.shape.cast
        .unwrap()
        .element.extend({
            profileUrl: storedImageUrlSchema.nullable(),
        })
        .array()
        .max(MOVIE_CAST_LIMIT)
        .nullable(),
});

export const movieDetailsResponseSchema = z.strictObject({
    result: z.discriminatedUnion('state', [
        z.strictObject({
            state: z.enum(['fresh', 'partial']),
            data: publicDetailsSchema,
            fetchedAt: z.iso.datetime(),
        }),
        z.strictObject({
            state: z.literal('stale'),
            data: publicDetailsSchema,
            fetchedAt: z.iso.datetime(),
            reason: movieProviderReasonSchema,
            retryAt: z.iso.datetime().optional(),
        }),
        z.strictObject({
            state: z.literal('unavailable'),
            reason: movieProviderReasonSchema,
            retryAt: z.iso.datetime().optional(),
        }),
    ]),
    links: z.strictObject({
        imdb: z
            .string()
            .regex(/^https:\/\/www\.imdb\.com\/title\/tt\d{7,12}\/$/u)
            .nullable(),
        /** PoiskKino IDs are Kinopoisk film IDs, so the verified ID builds the Kinopoisk page. */
        kinopoisk: z
            .string()
            .regex(/^https:\/\/www\.kinopoisk\.ru\/film\/[1-9]\d{0,15}\/$/u)
            .nullable(),
        /** Letterboxd resolves a film from its IMDb or TMDB ID. */
        letterboxd: z
            .string()
            .regex(/^https:\/\/letterboxd\.com\/(?:imdb\/tt\d{7,12}|tmdb\/[1-9]\d{0,15})\/$/u)
            .nullable(),
    }),
});
export type TMovieDetailsResponse = z.infer<typeof movieDetailsResponseSchema>;
