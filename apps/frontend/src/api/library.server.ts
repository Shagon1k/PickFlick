import 'server-only';

import type { TLibrary, TLibraryQuery } from '@pickflick/contracts';

import { requestApi } from '#lib/api.server';

export function getLibrary(query: TLibraryQuery) {
    const search = new URLSearchParams({ ...query, page: String(query.page) });
    return requestApi<TLibrary>(`/library?${search}`);
}
