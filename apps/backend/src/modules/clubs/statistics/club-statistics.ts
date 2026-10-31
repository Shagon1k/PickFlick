import type { IClubHub, TClubTier, TMovieDetails } from '@pickflick/contracts';

import { getTotalWatchHours, summarizeFilms } from '../../movies/cached-details.js';
import type { TCompletedScreening } from './completed-screenings.js';

export function buildClubStatistics(
    completed: TCompletedScreening[],
    metadata: Map<string, TMovieDetails>,
    tier: TClubTier,
    now = new Date(),
): IClubHub['statistics'] {
    const statistics: IClubHub['statistics'] = {
        sessionsWatched: completed.length,
        sessionsThisYear: completed.filter(
            (row) => row.scheduledAt?.getUTCFullYear() === now.getUTCFullYear(),
        ).length,
        averageRating: null,
        totalWatchHours: null,
        topGenre: null,
        topDirector: null,
        topActor: null,
    };
    if (tier === 'FREE') return statistics;
    const films = completed.map((row) => (row.movieId ? metadata.get(row.movieId) : undefined));
    const scores = completed.flatMap((row) => row.ratings.map(({ score }) => score));
    return {
        ...statistics,
        averageRating: scores.length
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null,
        // A Club without screenings has no watch time to estimate.
        totalWatchHours: completed.length ? getTotalWatchHours(films) : null,
        ...summarizeFilms(films),
    };
}
