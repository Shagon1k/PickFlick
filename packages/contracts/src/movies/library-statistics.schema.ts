import { z } from 'zod';

import { RATING_SCALE } from '../common/rating-scale.js';

export const libraryStatisticsSchema = z.strictObject({
    filmsRated: z.number().int().nonnegative(),
    ratedThisYear: z.number().int().nonnegative(),
    averageRating: z.number().min(RATING_SCALE.min).max(RATING_SCALE.max).nullable(),
    totalWatchHours: z.number().nonnegative().nullable(),
    watchlistCount: z.number().int().nonnegative(),
    favoriteGenre: z.string().nullable(),
    topDirector: z.string().nullable(),
    topActor: z.string().nullable(),
});
export type TLibraryStatistics = z.infer<typeof libraryStatisticsSchema>;
