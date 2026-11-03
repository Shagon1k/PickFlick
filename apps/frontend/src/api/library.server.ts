import 'server-only';

import type { TLibrary, TLibraryQuery, TLibraryStatistics } from '@pickflick/contracts';

import { requestApi } from '#lib/api.server';

export const getLibrary = (query: TLibraryQuery) => {
    const search = new URLSearchParams({
        tab: query.tab,
        sort: query.sort,
        page: String(query.page),
    });
    if (query.q) search.set('q', query.q);
    if (query.score) search.set('score', query.score);
    if (query.priority) search.set('priority', query.priority);
    if (query.direction) search.set('direction', query.direction);
    return requestApi<TLibrary>(`/library?${search}`);
};

export const getLibraryStatistics = () => requestApi<TLibraryStatistics>('/library/statistics');
