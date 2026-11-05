import type { TLibraryQuery } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

type TSort = Exclude<TLibraryQuery['sort'], 'genre'>;
type TDirection = TLibraryQuery['direction'];

export function getWatchlistOrder(sort: TSort, direction: TDirection) {
    const order: Record<TSort, Prisma.WatchlistItemOrderByWithRelationInput[]> = {
        title: [{ movie: { title: { sort: direction ?? 'asc', nulls: 'last' } } }],
        year: [{ movie: { releaseYear: { sort: direction ?? 'desc', nulls: 'last' } } }],
        recent: [{ addedAt: direction ?? 'desc' }],
        value: [{ priority: direction ?? 'desc' }],
        default: [{ priority: 'desc' }, { addedAt: 'asc' }],
    };
    return [...order[sort], { movieId: 'asc' as const }];
}

export function getRatingsOrder(sort: TSort, direction: TDirection) {
    const order: Record<TSort, Prisma.PersonalMovieRatingOrderByWithRelationInput[]> = {
        title: [{ movie: { title: { sort: direction ?? 'asc', nulls: 'last' } } }],
        year: [{ movie: { releaseYear: { sort: direction ?? 'desc', nulls: 'last' } } }],
        recent: [{ updatedAt: direction ?? 'desc' }],
        value: [{ score: direction ?? 'desc' }],
        default: [{ score: 'desc' }, { updatedAt: 'desc' }],
    };
    return [...order[sort], { movieId: 'asc' as const }];
}
