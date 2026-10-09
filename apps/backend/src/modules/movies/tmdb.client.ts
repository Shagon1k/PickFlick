import {
    movieSearchSchema,
    tmdbDetailsSchema,
    tmdbIdSchema,
    tmdbSearchSchema,
    type TMovieDetails,
    type TMovieSearch,
    type TMovieSearchResults,
    type TMovieSummary,
    type TTmdbMovie,
} from '@pickflick/contracts';
import type { z } from 'zod';

import { type IMovieProvider, MovieProviderError } from './movie-provider.js';
import { readTmdbResponse } from './tmdb-response.js';

function summary(movie: TTmdbMovie): TMovieSummary {
    return {
        tmdbId: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        overview: movie.overview,
        releaseDate: movie.release_date,
        adult: movie.adult,
        originalLanguage: movie.original_language,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        voteAverage: movie.vote_average,
        voteCount: movie.vote_count,
    };
}

export class TmdbClient implements IMovieProvider {
    private retryAt?: Date;

    constructor(
        private settings: { enabled: boolean; readToken?: string; timeoutMs: number },
        private request: typeof fetch = fetch,
    ) {}

    async search(input: TMovieSearch): Promise<TMovieSearchResults> {
        const { query, page } = movieSearchSchema.parse(input);
        const result = await this.get('/search/movie', tmdbSearchSchema, {
            query,
            page: String(page),
            include_adult: 'false',
        });
        if (result.page !== page) {
            throw new MovieProviderError('INVALID_RESPONSE');
        }
        const movies = [
            ...new Map(
                result.results
                    .filter((movie) => !movie.adult)
                    .map((movie) => [movie.id, summary(movie)]),
            ).values(),
        ];
        return { movies, page, totalPages: result.total_pages, totalResults: result.total_results };
    }

    async details(tmdbId: number): Promise<TMovieDetails> {
        tmdbIdSchema.parse(tmdbId);
        const movie = await this.get(`/movie/${tmdbId}`, tmdbDetailsSchema, {
            append_to_response: 'credits,videos',
        });
        if (movie.id !== tmdbId) {
            throw new MovieProviderError('INVALID_RESPONSE');
        }
        return {
            ...summary(movie),
            runtime: movie.runtime,
            genres: movie.genres,
            imdbId: movie.imdb_id || null,
            directors: movie.credits.crew
                .filter(({ job }) => job === 'Director')
                .map(({ id, name }) => ({ id, name })),
            cast: movie.credits.cast
                .toSorted((a, b) => a.order - b.order)
                .slice(0, 50)
                .map(({ id, name, character, profile_path }) => ({
                    id,
                    name,
                    character,
                    profilePath: profile_path,
                })),
            trailers: movie.videos.results
                .filter(
                    ({ site, type, key }) =>
                        site === 'YouTube' &&
                        type === 'Trailer' &&
                        /^[a-zA-Z0-9_-]{6,64}$/u.test(key),
                )
                .map(({ key, name, official }) => ({
                    key,
                    name,
                    official,
                    site: 'YouTube' as const,
                })),
        };
    }

    private async get<TData>(
        path: string,
        schema: z.ZodType<TData>,
        parameters: Record<string, string>,
    ): Promise<TData> {
        if (!this.settings.enabled || !this.settings.readToken) {
            throw new MovieProviderError('DISABLED');
        }
        if (this.retryAt && this.retryAt.getTime() > Date.now()) {
            throw new MovieProviderError('RATE_LIMITED', this.retryAt);
        }
        const url = new URL(`https://api.themoviedb.org/3${path}`);
        url.search = new URLSearchParams({ language: 'en-US', ...parameters }).toString();
        const signal = AbortSignal.timeout(this.settings.timeoutMs);
        try {
            const response = await this.request(url, {
                headers: {
                    Authorization: `Bearer ${this.settings.readToken}`,
                    Accept: 'application/json',
                },
                signal,
                redirect: 'error',
            });
            this.checkResponse(response);
            const body = await readTmdbResponse(response, signal);
            const parsed = schema.safeParse(body);
            if (!parsed.success) {
                throw new MovieProviderError('INVALID_RESPONSE');
            }
            return parsed.data;
        } catch (error) {
            if (error instanceof MovieProviderError) {
                throw error;
            }
            // Fetch errors can contain URLs or headers; translate without logging their text.
            throw new MovieProviderError(signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE');
        }
    }

    private checkResponse(response: Response): void {
        if (response.status === 429) {
            const header = response.headers.get('retry-after');
            const seconds = header && /^\d+$/u.test(header) ? Number(header) : NaN;
            const date = header ? Date.parse(header) : NaN;
            const delay = Number.isFinite(seconds) ? seconds * 1000 : date - Date.now();
            const bounded = Number.isFinite(delay)
                ? Math.min(86_400_000, Math.max(1000, delay))
                : 60_000;
            this.retryAt = new Date(Date.now() + bounded);
            throw new MovieProviderError('RATE_LIMITED', this.retryAt);
        }
        if (response.status === 404) {
            throw new MovieProviderError('NOT_FOUND');
        }
        if ([401, 403].includes(response.status)) {
            throw new MovieProviderError('AUTHENTICATION');
        }
        if (response.status >= 400 && response.status < 500) {
            throw new MovieProviderError('INVALID_RESPONSE');
        }
        if (!response.ok) {
            throw new MovieProviderError('UNAVAILABLE');
        }
    }
}
