import {
    MOVIE_CAST_LIMIT,
    movieSearchSchema,
    tmdbDetailsSchema,
    tmdbIdSchema,
    tmdbSearchSchema,
    type TMovieExternalId,
    type TMovieSearch,
    type TTmdbMovie,
} from '@pickflick/contracts';
import type { z } from 'zod';

import { MovieHttp } from './movie-http.js';
import {
    createEmptyMetadata,
    type IMovieLookup,
    type IMovieProvider,
    MovieProviderError,
    toProviderRecord,
    type TProviderRecord,
    type TProviderSearch,
} from './movie-provider.js';

const RATING_SCALE = 10;
const YEAR_LENGTH = 4;

function toSummary(movie: TTmdbMovie) {
    return {
        ...createEmptyMetadata(),
        title: movie.title,
        originalTitle: movie.original_title,
        overview: movie.overview || null,
        releaseDate: movie.release_date,
        releaseYear: movie.release_date ? Number(movie.release_date.slice(0, YEAR_LENGTH)) : null,
        adult: movie.adult,
        originalLanguage: movie.original_language || null,
        posterUrl: toImageUrl(movie.poster_path),
        backdropUrl: toImageUrl(movie.backdrop_path),
        ratings:
            movie.vote_count > 0
                ? [
                      {
                          source: 'tmdb',
                          value: movie.vote_average,
                          scale: RATING_SCALE,
                          voteCount: movie.vote_count,
                      },
                  ]
                : [],
    };
}
function toImageUrl(path: string | null) {
    return path ? `https://image.tmdb.org/t/p/original${path}` : null;
}
const WRITER_JOBS = new Set(['Screenplay', 'Writer']);

export class TmdbClient implements IMovieProvider {
    private http: MovieHttp;
    constructor(
        private settings: { enabled: boolean; readToken?: string; timeoutMs: number },
        request: typeof fetch = fetch,
    ) {
        this.http = new MovieHttp(
            'tmdb',
            'https://api.themoviedb.org',
            settings.timeoutMs,
            request,
        );
    }
    async search(input: TMovieSearch): Promise<TProviderSearch> {
        const { query, page, locale } = movieSearchSchema.parse(input);
        const fetchedAt = new Date().toISOString();
        const result = await this.get('/search/movie', tmdbSearchSchema, {
            language: locale,
            query,
            page: String(page),
            include_adult: 'false',
        });
        if (result.page !== page) throw new MovieProviderError('INVALID_RESPONSE');
        const movies = [
            ...new Map(
                result.results
                    .filter((movie) => !movie.adult)
                    .map((movie) => [
                        movie.id,
                        toProviderRecord({
                            source: 'tmdb',
                            locale,
                            fetchedAt,
                            externalIds: [{ source: 'tmdb', externalId: String(movie.id) }],
                            data: toSummary(movie),
                            similarExternalIds: null,
                        }),
                    ]),
            ).values(),
        ];
        return { movies, page, totalPages: result.total_pages, totalResults: result.total_results };
    }
    async fetchDetails(input: IMovieLookup): Promise<TProviderRecord> {
        const externalId = input.externalIds.find((id) => id.source === 'tmdb')?.externalId;
        if (!externalId) throw new MovieProviderError('MISSING_EXTERNAL_ID', undefined, 'tmdb');
        const tmdbId = tmdbIdSchema.parse(Number(externalId));
        const fetchedAt = new Date().toISOString();
        const movie = await this.get(`/movie/${tmdbId}`, tmdbDetailsSchema, {
            language: input.locale,
            append_to_response: 'credits,videos,similar',
        });
        if (movie.id !== tmdbId) throw new MovieProviderError('INVALID_RESPONSE');
        const externalIds: TMovieExternalId[] = [{ source: 'tmdb', externalId }];
        if (movie.imdb_id) externalIds.push({ source: 'imdb', externalId: movie.imdb_id });
        return toProviderRecord({
            source: 'tmdb',
            locale: input.locale,
            fetchedAt,
            externalIds,
            similarExternalIds: movie.similar
                ? [
                      ...new Set(
                          movie.similar.results
                              .filter((related) => !related.adult && related.id !== tmdbId)
                              .map((related) => related.id),
                      ),
                  ].map((id) => [{ source: 'tmdb' as const, externalId: String(id) }])
                : null,
            data: {
                ...toSummary(movie),
                runtime: movie.runtime || null,
                genres: movie.genres.map((genre) => genre.name),
                productionCountries: movie.production_countries.map(
                    (country) => country.iso_3166_1,
                ),
                directors: movie.credits.crew
                    .filter((person) => person.job === 'Director')
                    .map((person) => ({ name: person.name })),
                writers: [
                    ...new Set(
                        movie.credits.crew
                            .filter((person) => WRITER_JOBS.has(person.job))
                            .map((person) => person.name),
                    ),
                ].map((name) => ({ name })),
                budget: movie.budget || null,
                revenue: movie.revenue || null,
                cast: movie.credits.cast
                    .toSorted((a, b) => a.order - b.order)
                    .slice(0, MOVIE_CAST_LIMIT)
                    .map((person) => ({
                        name: person.name,
                        character: person.character || null,
                        profileUrl: toImageUrl(person.profile_path),
                    })),
                trailers: movie.videos.results
                    .filter(
                        (video) =>
                            video.site === 'YouTube' &&
                            video.type === 'Trailer' &&
                            /^[a-zA-Z0-9_-]{6,64}$/u.test(video.key),
                    )
                    .map((video) => ({
                        url: `https://www.youtube.com/watch?v=${video.key}`,
                        name: video.name || null,
                        official: video.official,
                    })),
            },
        });
    }

    private async get<TData>(
        path: string,
        schema: z.ZodType<TData>,
        parameters: Record<string, string>,
    ): Promise<TData> {
        if (!this.settings.enabled || !this.settings.readToken) {
            throw new MovieProviderError('DISABLED');
        }
        const query = new URLSearchParams({ language: 'en-US', ...parameters });
        return this.http.get(`/3${path}?${query.toString()}`, schema, {
            Authorization: `Bearer ${this.settings.readToken}`,
            Accept: 'application/json',
        });
    }
}
