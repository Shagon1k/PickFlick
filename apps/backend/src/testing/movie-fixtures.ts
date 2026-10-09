import type { TMovieDetails } from '@pickflick/contracts';

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

export function movieDetails(tmdbId = 100): TMovieDetails {
    return {
        tmdbId,
        title: 'Synthetic Movie',
        originalTitle: 'Synthetic Movie',
        overview: 'Synthetic provider metadata.',
        releaseDate: '2026-01-01',
        adult: false,
        originalLanguage: 'en',
        posterPath: '/synthetic.jpg',
        backdropPath: null,
        voteAverage: 7,
        voteCount: 10,
        runtime: 120,
        genres: [{ id: 18, name: 'Drama' }],
        imdbId: 'tt1234567',
        directors: [{ id: 1, name: 'Synthetic Director' }],
        cast: [{ id: 2, name: 'Synthetic Actor', character: 'Lead', profilePath: null }],
        trailers: [],
    };
}
