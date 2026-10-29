import 'server-only';

import type { TLibrary, TLibraryQuery, TLibraryStatistics } from '@pickflick/contracts';

import { requestApi } from '#lib/api.server';

export const getLibrary = (query: TLibraryQuery) => {
    const search = new URLSearchParams({ ...query, page: String(query.page) });
    return requestApi<TLibrary>(`/library?${search}`);
};

export const getLibraryStatistics = () => requestApi<TLibraryStatistics>('/library/statistics');
