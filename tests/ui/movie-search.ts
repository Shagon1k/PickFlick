import type {
    TMovieProviderReason,
    TMovieResult,
    TMovieSearchResults,
    TMovieSummary,
} from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

export function handleMovieSearch(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    if (pathname !== '/movies/search' || request.method !== 'POST') return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-movies-auth');
        return true;
    }
    readJson<{ query: string }>(request, ({ query }) => {
        const reason = UNAVAILABLE_QUERIES[query];
        if (reason) {
            send(response, { state: 'unavailable', reason }, 0);
            return;
        }
        const movie = (id: string, title: string): TMovieSummary => ({
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
        const data: TMovieSearchResults = {
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
        const fetchedAt = '2026-10-10T12:00:00.000Z';
        send(
            response,
            query === 'stale'
                ? { state: 'stale', reason: 'TIMEOUT', data, fetchedAt }
                : { state: 'fresh', data, fetchedAt },
            query === 'slow' ? 1200 : 100,
        );
    });
    return true;
}

const UNAVAILABLE_QUERIES: Partial<Record<string, TMovieProviderReason>> = {
    outage: 'UNAVAILABLE',
    limited: 'RATE_LIMITED',
    disabled: 'DISABLED',
};

function send(
    response: TMockResponse,
    result: TMovieResult<TMovieSearchResults>,
    delayMs: number,
): void {
    setTimeout(() => sendJson(response, 200, result), delayMs);
}
