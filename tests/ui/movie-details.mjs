import { sendError, sendJson } from './mock-http.mjs';

export function handleMovieDetails(request, response, pathname, token) {
    if (!pathname.startsWith('/movies/') || request.method !== 'GET') return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-movie-auth');
        return true;
    }
    const id = pathname.split('/').at(-1);
    const reason = {
        'valid-movie-outage': 'UNAVAILABLE',
        'valid-movie-limited': 'RATE_LIMITED',
        'valid-movie-disabled': 'DISABLED',
        'valid-movie-not-found': 'NOT_FOUND',
    }[token];
    if (id.endsWith('038') && token === 'valid-movie-related-unavailable') {
        sendJson(response, 200, {
            result: { state: 'unavailable', reason: 'UNAVAILABLE' },
            externalIds: [],
        });
        return true;
    }
    if (reason) {
        sendJson(response, 200, { result: { state: 'unavailable', reason }, externalIds: [] });
        return true;
    }
    const missing = token === 'valid-movie-missing';
    const related = id.endsWith('038');
    const result = {
        state: { 'valid-movie-stale': 'stale', 'valid-movie-partial': 'partial' }[token] ?? 'fresh',
        fetchedAt: '2026-10-10T12:00:00.000Z',
        data: movieData(id, missing, related),
    };
    if (result.state === 'stale') result.reason = 'TIMEOUT';
    sendJson(response, 200, {
        result,
        externalIds: missing ? [] : [{ source: 'imdb', externalId: 'tt1234567' }],
    });
    return true;
}

function movieData(id, missing, related) {
    return {
        id,
        title: related ? 'Related Film' : '<script>alert(1)</script> & Film',
        originalTitle: null,
        overview: missing ? null : 'A synthetic synopsis. '.repeat(100),
        releaseDate: null,
        releaseYear: missing ? null : 2026,
        adult: false,
        originalLanguage: 'en',
        posterUrl: missing ? null : 'https://image.tmdb.org/t/p/original/synthetic.jpg',
        backdropUrl: null,
        ratings: missing ? [] : [{ source: 'tmdb', value: 7, scale: 10, voteCount: 10 }],
        runtime: missing ? null : 120,
        genres: missing ? null : ['Drama'],
        directors: missing ? null : [{ name: '<Synthetic Director>' }],
        cast: missing ? null : [{ name: 'Synthetic Actor', character: 'Lead', profileUrl: null }],
        trailers: missing
            ? null
            : [
                  {
                      url: 'https://www.youtube.com/watch?v=abc123XYZ-_',
                      name: 'Watch trailer',
                      official: true,
                  },
              ],
        provenance: [
            {
                source: 'tmdb',
                fetchedAt: '2026-10-10T12:00:00.000Z',
                reason: null,
                sections: ['metadata', 'media', 'similar'],
            },
        ],
        similarMovieIds: missing || related ? null : ['10000000-0000-4000-8000-000000000038'],
    };
}
