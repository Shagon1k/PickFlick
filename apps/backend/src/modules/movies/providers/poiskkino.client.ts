import {
    movieImageUrlSchema,
    movieSearchSchema,
    movieTrailerUrlSchema,
    type TMovieExternalId,
    type TMovieSearch,
} from '@pickflick/contracts';
import { z } from 'zod';

import { MovieHttp } from './movie-http.js';
import {
    createEmptyMetadata,
    MovieProviderError,
    parseSourceSnapshot,
    type TSourceSnapshot,
} from './movie-provider.js';

const RATING_SCALE = 10;
// The provider sends a full timestamp; Movies keep its `YYYY-MM-DD` part.
const ISO_DATE_LENGTH = 10;

const text = z.string().max(20000).nullish();
const number = z.number().nonnegative().nullish();
const image = z.object({ url: movieImageUrlSchema.nullish() }).nullish();
const related = z.object({ id: z.number().int().positive() });
const wire = z.object({
    id: z.number().int().positive(),
    type: z.string().nullish(),
    isSeries: z.boolean().nullish(),
    premiere: z.object({ world: z.iso.datetime({ offset: true }).nullish() }).nullish(),
    enName: text,
    name: text,
    alternativeName: text,
    externalId: z
        .object({ imdb: z.string().nullish(), tmdb: z.number().int().positive().nullish() })
        .nullish(),
    year: number,
    ageRating: number,
    movieLength: number,
    poster: image,
    backdrop: image,
    rating: z.object({ kp: number, imdb: number, tmdb: number }).nullish(),
    votes: z
        .object({
            kp: z
                .union([
                    z.number().int().nonnegative(),
                    z.string().regex(/^\d+$/u).transform(Number),
                ])
                .nullish(),
            imdb: number,
            tmdb: number,
        })
        .nullish(),
    videos: z
        .object({
            trailers: z
                .array(z.object({ url: z.string().nullish() }))
                .max(100)
                .nullish(),
        })
        .nullish(),
    similarMovies: z.array(related).max(100).nullish(),
});
const searchWire = z.object({
    docs: z.array(wire).max(100),
    page: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
});
export class PoiskkinoClient {
    private http: MovieHttp;
    constructor(
        private settings: { enabled: boolean; apiKey?: string; timeoutMs: number },
        request: typeof fetch = fetch,
    ) {
        this.http = new MovieHttp(
            'poiskkino',
            'https://api.poiskkino.dev',
            settings.timeoutMs,
            request,
        );
    }
    async search(input: TMovieSearch) {
        const parsed = movieSearchSchema.parse(input);
        this.requireEnabled();
        const fetchedAt = new Date().toISOString();
        const query = new URLSearchParams({
            query: parsed.query,
            page: String(parsed.page),
            limit: '20',
        });
        const result = await this.http.get(
            `/v1.5/movie/search?${query.toString()}`,
            searchWire,
            this.headers(),
        );
        if (result.page !== parsed.page)
            throw new MovieProviderError('INVALID_RESPONSE', undefined, 'poiskkino');
        return {
            movies: [
                ...new Map(
                    result.docs
                        .filter(
                            (movie) =>
                                ['movie', 'cartoon'].includes(movie.type ?? '') &&
                                movie.isSeries !== true,
                        )
                        .map((movie) => [movie.id, this.map(movie, fetchedAt, false)]),
                ).values(),
            ],
            page: parsed.page,
            totalPages: result.pages,
            totalResults: result.total,
        };
    }
    async details(externalIds: TMovieExternalId[]): Promise<TSourceSnapshot> {
        this.requireEnabled();
        const id = externalIds.find((id) => id.source === 'poiskkino')?.externalId;
        if (!id) throw new MovieProviderError('MISSING_EXTERNAL_ID', undefined, 'poiskkino');
        const fetchedAt = new Date().toISOString();
        const movie = await this.http.get(`/v1.5/movie/${id}`, wire, this.headers());
        if (
            String(movie.id) !== id ||
            !['movie', 'cartoon'].includes(movie.type ?? '') ||
            movie.isSeries === true
        )
            throw new MovieProviderError('INVALID_RESPONSE', undefined, 'poiskkino');
        return this.map(movie, fetchedAt, true);
    }
    private map(
        movie: z.infer<typeof wire>,
        fetchedAt: string,
        withDetails: boolean,
    ): TSourceSnapshot {
        const externalIds: TMovieExternalId[] = [
            { source: 'poiskkino', externalId: String(movie.id) },
        ];
        if (movie.externalId?.imdb)
            externalIds.push({ source: 'imdb', externalId: movie.externalId.imdb });
        if (movie.externalId?.tmdb)
            externalIds.push({ source: 'tmdb', externalId: String(movie.externalId.tmdb) });
        const ratings = (['kp', 'imdb', 'tmdb'] as const).flatMap((source) => {
            const value = movie.rating?.[source];
            const votes = movie.votes?.[source];
            return value != null && value > 0
                ? [
                      {
                          source: source === 'kp' ? 'kinopoisk' : source,
                          value,
                          scale: RATING_SCALE,
                          voteCount: votes ?? null,
                      },
                  ]
                : [];
        });
        return parseSourceSnapshot({
            source: 'poiskkino',
            locale: 'en-US',
            fetchedAt,
            externalIds,
            similarExternalIds:
                withDetails && movie.similarMovies
                    ? movie.similarMovies.map((movie) => [
                          { source: 'poiskkino', externalId: String(movie.id) },
                      ])
                    : null,
            data: {
                ...createEmptyMetadata(),
                title: movie.enName || null,
                // alternativeName and description have no guaranteed English locale.
                releaseDate: movie.premiere?.world?.slice(0, ISO_DATE_LENGTH) ?? null,
                releaseYear: movie.year ?? null,
                runtime: movie.movieLength || null,
                posterUrl: movie.poster?.url ?? null,
                backdropUrl: movie.backdrop?.url ?? null,
                ratings,
                // Trailer labels have no guaranteed English locale.
                trailers:
                    withDetails && movie.videos?.trailers
                        ? movie.videos.trailers.flatMap((video) =>
                              video.url && movieTrailerUrlSchema.safeParse(video.url).success
                                  ? [{ url: video.url, name: null, official: null }]
                                  : [],
                          )
                        : null,
            },
        });
    }
    private headers() {
        return { 'X-API-KEY': this.settings.apiKey ?? '', Accept: 'application/json' };
    }
    private requireEnabled() {
        if (!this.settings.enabled || !this.settings.apiKey)
            throw new MovieProviderError('DISABLED', undefined, 'poiskkino');
    }
}
