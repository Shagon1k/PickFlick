import type {
    TSaveWatchlist,
    TWatchlist,
    TWatchlistItem,
    TWatchlistResponse,
} from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const itemsBySession = new Map<string, Map<string, TWatchlistItem>>();

export function getLibraryWatchlist(token: string) {
    return [...(itemsBySession.get(token)?.values() ?? [])].map((item) => ({
        ...item,
        title: 'The Grand Budapest Hotel',
        releaseYear: 2014,
        genres: ['Comedy', 'Drama'],
    }));
}

export function handleWatchlist(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    const match = /^\/movies\/([0-9a-f-]{36})\/watchlist$/u.exec(pathname);
    if (pathname !== '/watchlist' && !match) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-watchlist');
        return true;
    }
    if (
        token === 'valid-watchlist-unavailable' ||
        (token === 'valid-watchlist-failure' && request.method !== 'GET')
    ) {
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-watchlist');
        return true;
    }
    const items = itemsBySession.get(token) ?? new Map<string, TWatchlistItem>();
    itemsBySession.set(token, items);
    if (pathname === '/watchlist') {
        const body: TWatchlist = {
            items: [...items.values()].map((item) => ({
                ...item,
                title: 'The Grand Budapest Hotel',
                releaseYear: 2014,
            })),
        };
        sendJson(response, 200, body);
        return true;
    }
    const movieId = match![1]!;
    if (request.method === 'GET') {
        const body: TWatchlistResponse = { item: items.get(movieId) ?? null };
        sendJson(response, 200, body);
    } else if (request.method === 'PUT') {
        readJson<TSaveWatchlist>(request, (body) => {
            const item: TWatchlistItem = {
                movieId,
                priority: body.priority,
                addedAt: items.get(movieId)?.addedAt ?? new Date().toISOString(),
            };
            items.set(movieId, item);
            sendJson(response, 200, item);
        });
    } else if (request.method === 'DELETE') {
        items.delete(movieId);
        response.writeHead(204).end();
    }
    return true;
}
