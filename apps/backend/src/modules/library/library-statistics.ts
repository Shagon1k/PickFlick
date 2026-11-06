import type { TLibraryStatistics } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { getTotalWatchHours, readCachedDetails, summarizeFilms } from '../movies/cached-details.js';

interface IRatedMovie {
    score: number;
    updatedAt: Date;
    movie: { details: { data: Prisma.JsonValue }[] };
}

export function buildLibraryStatistics(
    ratings: IRatedMovie[],
    watchlistCount: number,
    now = new Date(),
): TLibraryStatistics {
    const films = ratings.map(({ movie }) => readCachedDetails(movie.details[0]));
    const { topGenre, topDirector, topActor } = summarizeFilms(films);
    return {
        filmsRated: ratings.length,
        ratedThisYear: ratings.filter(
            (rating) => rating.updatedAt.getUTCFullYear() === now.getUTCFullYear(),
        ).length,
        averageRating: ratings.length
            ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
            : null,
        totalWatchHours: getTotalWatchHours(films),
        watchlistCount,
        favoriteGenre: topGenre,
        topDirector,
        topActor,
    };
}
