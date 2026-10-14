import { createHash } from 'node:crypto';

import type { TMovieSearch } from '@pickflick/contracts';

/** Switching provider or locale starts a separate cache; old entries simply age out. */
function buildCatalogCacheKey(provider: string, ...values: unknown[]): string {
    return createHash('sha256')
        .update(JSON.stringify([provider, ...values]))
        .digest('hex');
}

/** The key of one search page; pass the search after its schema filled in the defaults. */
export function buildSearchCacheKey(provider: string, search: TMovieSearch): string {
    return buildCatalogCacheKey(provider, search.locale, search.query, search.page);
}

/** The key of Movie details in one locale. */
export function buildDetailsCacheKey(provider: string, locale: string): string {
    return buildCatalogCacheKey(provider, locale);
}
