import 'server-only';

import type { TSaveWatchlist, TWatchlistItem, TWatchlistResponse } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export async function getWatchlistItem(movieId: string) {
    const response = await requestApi<TWatchlistResponse>(apiPath`/movies/${movieId}/watchlist`);
    return response.item;
}

export const saveWatchlistItem = (movieId: string, input: TSaveWatchlist) =>
    requestApi<TWatchlistItem>(apiPath`/movies/${movieId}/watchlist`, {
        method: 'PUT',
        json: input,
    });

export const removeWatchlistItem = (movieId: string) =>
    requestApi<void>(apiPath`/movies/${movieId}/watchlist`, { method: 'DELETE' });
