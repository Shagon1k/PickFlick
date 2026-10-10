import { readJson, sendError, sendJson } from './mock-http.mjs';

export function handleMovieSearch(request, response, pathname, token) {
    if (pathname !== '/movies/search' || request.method !== 'POST') return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-movies-auth');
        return true;
    }
    readJson(request, ({ query }) => {
        const reason = { outage: 'UNAVAILABLE', limited: 'RATE_LIMITED', disabled: 'DISABLED' }[
            query
        ];
        if (reason) {
            sendJson(response, 200, { state: 'unavailable', reason });
            return;
        }
        const movie = (id, title) => ({
            id,
            title,
            originalTitle: null,
            overview: null,
            releaseDate: null,
            releaseYear: 2026,
            adult: false,
            originalLanguage: 'en',
            posterUrl: null,
            backdropUrl: null,
            ratings: [],
            provenance: [
                {
                    source: 'poiskkino',
                    fetchedAt: '2026-10-10T12:00:00.000Z',
                    reason: null,
                    sections: ['metadata'],
                },
            ],
        });
        const data = {
            movies:
                query === 'empty'
                    ? []
                    : [
                          movie(
                              '10000000-0000-4000-8000-000000000037',
                              query === 'slow' ? 'Old film' : '<script>alert(1)</script> & Film',
                          ),
                          movie('10000000-0000-4000-8000-000000000038', 'Second Film'),
                      ],
            page: 1,
            totalPages: 1,
            totalResults: query === 'empty' ? 0 : 2,
        };
        const result = {
            state: query === 'stale' ? 'stale' : 'fresh',
            data,
            fetchedAt: '2026-10-10T12:00:00.000Z',
        };
        if (query === 'stale') result.reason = 'TIMEOUT';
        setTimeout(() => sendJson(response, 200, result), query === 'slow' ? 1200 : 100);
    });
    return true;
}
