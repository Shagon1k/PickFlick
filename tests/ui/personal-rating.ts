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
            if (token === 'valid-rating-failure') {
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-personal-rating');
                return;
            }
            const rating: TPersonalMovieRating = {
                score: body.score,
                source: 'PERSONAL',
                updatedAt: new Date().toISOString(),
            };
            ratings.set(key, rating);
            sendJson(response, 200, rating);
        });
        return true;
    }
    return false;
}
