import { z } from 'zod';

export const libraryStatisticsQuerySchema = z.strictObject({});
export const libraryStatisticsSchema = z.strictObject({
    filmsRated: z.number().int().nonnegative(),
    ratedThisYear: z.number().int().nonnegative(),
    averageRating: z.number().min(1).max(10).nullable(),
    totalWatchHours: z.number().nonnegative().nullable(),
    watchlistCount: z.number().int().nonnegative(),
    favoriteGenre: z.string().nullable(),
    topDirector: z.string().nullable(),
    topActor: z.string().nullable(),
});
export type TLibraryStatistics = z.infer<typeof libraryStatisticsSchema>;
