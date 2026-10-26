import type {
    TPersonalMovieRating,
    TPersonalRatingResponse,
    TSavePersonalRating,
} from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const ratings = new Map<string, TPersonalMovieRating>();

export function getLibraryRatings(token: string) {
    const movieIds = token.startsWith('valid-library-')
        ? Array.from(
              { length: 28 },
              (_, index) => `10000000-0000-4000-8000-${String(37 + index).padStart(12, '0')}`,
          )
        : [...ratings.keys()]
              .filter((key) => key.startsWith(`${token}:`))
              .map((key) => key.split('/')[2]!);
    return movieIds.map((movieId, index) => ({
        movieId,
        title:
            index === 0
                ? 'The Grand Budapest Hotel'
                : `Rated film ${String(index).padStart(2, '0')} ${'a long film title '.repeat(8)}`,
        releaseYear: 2014,
        genres: ['Comedy', 'Drama'],
        ...(ratings.get(`${token}:/movies/${movieId}/personal-rating`) ?? {
            score: 8,
            source: 'PERSONAL' as const,
            updatedAt: '2026-01-01T00:00:00.000Z',
        }),
    }));
}

export function handlePersonalRating(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    if (!pathname.endsWith('/personal-rating')) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-personal-rating');
        return true;
    }
    const key = `${token}:${pathname}`;
    if (request.method === 'GET') {
        const body: TPersonalRatingResponse = { rating: ratings.get(key) ?? null };
        sendJson(response, 200, body);
        return true;
    }
    if (request.method === 'PUT') {
        readJson<TSavePersonalRating>(request, (body) => {
            if (token === 'valid-rating-failure' || token === 'valid-library-errors') {
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-personal-rating');
                return;
            }
            const rating: TPersonalMovieRating = {
                score: body.score,
                source: 'PERSONAL',
                updatedAt: '2026-10-01T20:00:00.000Z',
            };
            ratings.set(key, rating);
            sendJson(response, 200, rating);
        });
        return true;
    }
    return false;
}
