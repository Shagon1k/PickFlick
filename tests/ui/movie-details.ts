import type { TMovieDetailsResponse, TMovieProviderReason } from '@pickflick/contracts';

import { sendError, sendJson, type TMockRequest, type TMockResponse } from './mock-http.ts';

export function handleMovieDetails(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    if (!pathname.startsWith('/movies/') || request.method !== 'GET') return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-movie-auth');
        return true;
    }
    const id = pathname.split('/').at(-1) ?? '';
    const reason = (
        {
            'valid-movie-outage': 'UNAVAILABLE',
            'valid-movie-limited': 'RATE_LIMITED',
            'valid-movie-disabled': 'DISABLED',
            'valid-movie-not-found': 'NOT_FOUND',
        } as Record<string, TMovieProviderReason>
    )[token];
    if (id.endsWith('038') && token === 'valid-movie-related-unavailable') {
        sendDetails(response, {
            result: { state: 'unavailable', reason: 'UNAVAILABLE' },
            links: { imdb: null },
        });
        return true;
    }
    if (reason) {
        sendDetails(response, { result: { state: 'unavailable', reason }, links: { imdb: null } });
        return true;
    }
    const isMissing = token === 'valid-movie-missing';
    const isRelated = id.endsWith('038');
    const data = movieData(id, isMissing, isRelated);
    const fetchedAt = '2026-10-10T12:00:00.000Z';
    let result: TMovieDetailsResponse['result'] = { state: 'fresh', fetchedAt, data };
    if (token === 'valid-movie-stale')
        result = { state: 'stale', reason: 'TIMEOUT', fetchedAt, data };
    if (token === 'valid-movie-partial') result = { state: 'partial', fetchedAt, data };
    sendDetails(response, {
        result,
        links: { imdb: isMissing ? null : 'https://www.imdb.com/title/tt1234567/' },
    });
    return true;
}

type TPublicDetails = Extract<TMovieDetailsResponse['result'], { data: unknown }>['data'];

function sendDetails(response: TMockResponse, body: TMovieDetailsResponse): void {
    sendJson(response, 200, body);
}

function movieData(id: string, isMissing: boolean, isRelated: boolean): TPublicDetails {
    return {
        id,
        title: isRelated ? 'Related Film' : '<script>alert(1)</script> & Film',
        originalTitle: null,
        overview: isMissing ? null : 'A synthetic synopsis. '.repeat(100),
        releaseDate: null,
        releaseYear: isMissing ? null : 2026,
        adult: false,
        originalLanguage: 'en',
        posterUrl: isMissing ? null : `/api/movies/images/${'a'.repeat(64)}`,
        backdropUrl: null,
        ratings: isMissing
            ? []
            : [
                  { source: 'tmdb', value: 7, scale: 10, voteCount: 10 },
                  { source: 'kinopoisk', value: 7.519, scale: 10, voteCount: 109356 },
                  { source: 'imdb', value: 7.55, scale: 10, voteCount: 431000 },
              ],
        runtime: isMissing ? null : 120,
        genres: isMissing ? null : ['Drama'],
        directors: isMissing ? null : [{ name: '<Synthetic Director>' }],
        writers: isMissing ? null : [{ name: 'Synthetic Writer' }],
        budget: isMissing ? null : 168_000_000,
        revenue: isMissing ? null : 174_000_000,
        cast: isMissing ? null : [{ name: 'Synthetic Actor', character: 'Lead', profileUrl: null }],
        trailers: isMissing
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
        similarMovieIds: isMissing || isRelated ? null : ['10000000-0000-4000-8000-000000000038'],
    };
}
