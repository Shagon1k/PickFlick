import type { TLibraryQuery } from '@pickflick/contracts';

export function buildLibraryPath(query: TLibraryQuery, page = query.page) {
    const search = new URLSearchParams({ tab: query.tab, sort: query.sort, page: String(page) });
    if (query.q) search.set('q', query.q);
    if (query.score) search.set('score', query.score);
    if (query.priority) search.set('priority', query.priority);
    if (query.direction) search.set('direction', query.direction);
    return `/library?${search}`;
}
