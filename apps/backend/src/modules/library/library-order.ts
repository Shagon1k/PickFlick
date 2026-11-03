import type { TLibraryQuery } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

type TSort = Exclude<TLibraryQuery['sort'], 'genre'>;

export function getWatchlistOrder(query: TLibraryQuery & { sort: TSort }) {
    const order: Record<TSort, Prisma.WatchlistItemOrderByWithRelationInput[]> = {
        title: [{ movie: { title: { sort: query.direction ?? 'asc', nulls: 'last' } } }],
        year: [{ movie: { releaseYear: { sort: query.direction ?? 'desc', nulls: 'last' } } }],
        recent: [{ addedAt: query.direction ?? 'desc' }],
        value: [{ priority: query.direction ?? 'desc' }],
        default: [{ priority: 'desc' }, { addedAt: 'asc' }],
    };
    return [...order[query.sort], { movieId: 'asc' as const }];
}

export function getRatingsOrder(query: TLibraryQuery & { sort: TSort }) {
    const order: Record<TSort, Prisma.PersonalMovieRatingOrderByWithRelationInput[]> = {
        title: [{ movie: { title: { sort: query.direction ?? 'asc', nulls: 'last' } } }],
        year: [{ movie: { releaseYear: { sort: query.direction ?? 'desc', nulls: 'last' } } }],
        recent: [{ updatedAt: query.direction ?? 'desc' }],
        value: [{ score: query.direction ?? 'desc' }],
        default: [{ score: 'desc' }, { updatedAt: 'desc' }],
    };
    return [...order[query.sort], { movieId: 'asc' as const }];
}
