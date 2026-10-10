import {
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
    emptyMetadata,
    type IMovieLookup,
    type IMovieProvider,
    MovieProviderError,
    singleSource,
    type TProviderRecord,
    type TProviderSearch,
} from './movie-provider.js';

function summary(movie: TTmdbMovie) {
    return {
        ...emptyMetadata(),
        title: movie.title,
        originalTitle: movie.original_title,
        overview: movie.overview || null,
        releaseDate: movie.release_date,
        releaseYear: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
        adult: movie.adult,
        originalLanguage: movie.original_language || null,
        posterUrl: image(movie.poster_path),
        backdropUrl: image(movie.backdrop_path),
        ratings:
            movie.vote_count > 0
                ? [
                      {
                          source: 'tmdb',
                          value: movie.vote_average,
                          scale: 10,
                          voteCount: movie.vote_count,
                      },
                  ]
                : [],
    };
}
function image(path: string | null) {
    return path ? `https://image.tmdb.org/t/p/original${path}` : null;
}
export class TmdbClient implements IMovieProvider {
    get configurationKey() {
        return `tmdb:v1:enabled=${this.settings.enabled}`;
    }
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
                        singleSource({
                            source: 'tmdb',
                            locale,
                            fetchedAt,
                            externalIds: [{ source: 'tmdb', externalId: String(movie.id) }],
                            data: summary(movie),
                            similarExternalIds: null,
                        }),
                    ]),
            ).values(),
        ];
        return { movies, page, totalPages: result.total_pages, totalResults: result.total_results };
    }
    async details(input: IMovieLookup): Promise<TProviderRecord> {
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
        return singleSource({
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
                ...summary(movie),
                runtime: movie.runtime || null,
                genres: movie.genres.map((genre) => genre.name),
                directors: movie.credits.crew
                    .filter((person) => person.job === 'Director')
                    .map((person) => ({ name: person.name })),
                cast: movie.credits.cast
                    .toSorted((a, b) => a.order - b.order)
                    .slice(0, 50)
                    .map((person) => ({
                        name: person.name,
                        character: person.character || null,
                        profileUrl: image(person.profile_path),
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
