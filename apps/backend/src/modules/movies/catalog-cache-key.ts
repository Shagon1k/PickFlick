import { createHash } from 'node:crypto';

/** Switching provider or locale starts a separate cache; old entries simply age out. */
export function buildCatalogCacheKey(provider: string, ...values: unknown[]): string {
    return createHash('sha256')
        .update(JSON.stringify([provider, ...values]))
        .digest('hex');
}
