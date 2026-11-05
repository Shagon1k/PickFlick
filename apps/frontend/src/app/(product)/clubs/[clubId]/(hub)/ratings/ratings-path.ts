import type { TClubRatingsQuery } from '@pickflick/contracts';

export function buildClubRatingsPath(clubId: string, query: TClubRatingsQuery) {
    const search = new URLSearchParams({ sort: query.sort, page: String(query.page) });
    if (query.q) search.set('q', query.q);
    if (query.direction) search.set('direction', query.direction);
    return `/clubs/${clubId}/ratings?${search}`;
}
