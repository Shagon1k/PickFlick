import 'server-only';

import type {
    TSaveWatchlist,
    TWatchlist,
    TWatchlistItem,
    TWatchlistResponse,
} from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export function getWatchlist() {
    return requestApi<TWatchlist>('/watchlist');
}

export async function getWatchlistItem(movieId: string) {
    const response = await requestApi<TWatchlistResponse>(apiPath`/movies/${movieId}/watchlist`);
    return response.item;
}

export function saveWatchlistItem(movieId: string, input: TSaveWatchlist) {
    return requestApi<TWatchlistItem>(apiPath`/movies/${movieId}/watchlist`, {
        method: 'PUT',
        json: input,
    });
}

export function removeWatchlistItem(movieId: string) {
    return requestApi<void>(apiPath`/movies/${movieId}/watchlist`, { method: 'DELETE' });
}
