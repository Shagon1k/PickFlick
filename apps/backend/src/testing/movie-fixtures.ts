import { movieDetailsSchema } from '@pickflick/contracts';

import {
    emptyMetadata,
    type IMovieLookup,
    singleSource,
} from '../modules/movies/providers/movie-provider.js';

export function tmdbMovie(tmdbId = 100) {
    return {
        id: tmdbId,
        title: '<Synthetic Movie>',
        original_title: 'Synthetic Movie',
        overview: 'Synthetic provider metadata.',
        release_date: '2026-01-01',
        adult: false,
        original_language: 'en',
        poster_path: '/synthetic.jpg',
        backdrop_path: null,
        vote_average: 7,
        vote_count: 10,
    };
}

export function tmdbDetails(tmdbId = 100) {
    return {
        ...tmdbMovie(tmdbId),
        runtime: 120,
        genres: [{ id: 18, name: 'Drama' }],
        imdb_id: 'tt1234567',
        credits: {
            cast: [
                { id: 2, name: 'Synthetic Actor', character: 'Lead', profile_path: null, order: 0 },
            ],
            crew: [{ id: 1, name: 'Synthetic Director', job: 'Director' }],
        },
        videos: {
            results: [
                {
                    key: 'abc123XYZ-_',
                    name: 'Trailer',
                    site: 'YouTube',
                    type: 'Trailer',
                    official: true,
                },
            ],
        },
    };
}

export const MOVIE_ID = '00000000-0000-4000-8000-000000000100';
export function movieLookup(tmdbId = 100): IMovieLookup {
    return {
        externalIds: [{ source: 'tmdb', externalId: String(tmdbId) }],
        locale: 'en-US',
        movieId: MOVIE_ID,
        forceRefresh: false,
        allowStale: false,
    };
}
export function movieDetails(tmdbId = 100, fetchedAt = '2026-10-09T12:00:00.000Z') {
    return singleSource({
        source: 'tmdb',
        locale: 'en-US',
        fetchedAt,
        externalIds: [
            { source: 'tmdb', externalId: String(tmdbId) },
            { source: 'imdb', externalId: `tt${String(tmdbId).padStart(7, '0')}` },
        ],
        similarExternalIds: null,
        data: {
            ...emptyMetadata(),
            title: 'Synthetic Movie',
            originalTitle: 'Synthetic Movie',
            overview: 'Synthetic provider metadata.',
            releaseDate: '2026-01-01',
            releaseYear: 2026,
            adult: false,
            originalLanguage: 'en',
            posterUrl: 'https://image.tmdb.org/t/p/original/synthetic.jpg',
            ratings: [{ source: 'tmdb', value: 7, scale: 10, voteCount: 10 }],
            runtime: 120,
            genres: ['Drama'],
            directors: [{ name: 'Synthetic Director' }],
            cast: [{ name: 'Synthetic Actor', character: 'Lead', profileUrl: null }],
            trailers: [],
        },
    });
}
export function canonicalDetails(
    tmdbId = 100,
    fetchedAt = '2026-10-09T12:00:00.000Z',
    id = MOVIE_ID,
) {
    const record = movieDetails(tmdbId, fetchedAt);
    return movieDetailsSchema.parse({
        id,
        ...record.data,
        provenance: record.provenance,
        similarMovieIds: null,
    });
}
