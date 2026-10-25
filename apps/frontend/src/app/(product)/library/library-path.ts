import type { TLibraryQuery } from '@pickflick/contracts';

export function buildLibraryPath(query: TLibraryQuery, page = query.page) {
    return `/library?${new URLSearchParams({ ...query, page: String(page) })}`;
}
