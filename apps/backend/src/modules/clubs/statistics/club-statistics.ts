import type { IClubHub, TClubTier, TMovieDetails } from '@pickflick/contracts';

import type { TCompletedScreening } from './completed-screenings.js';

const MINUTES_PER_HOUR = 60;

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
    const movies = completed.map((row) => (row.movieId ? metadata.get(row.movieId) : undefined));
    const scores = completed.flatMap((row) => row.ratings.map(({ score }) => score));
    return {
        ...statistics,
        averageRating: scores.length
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null,
        totalWatchHours:
            completed.length && movies.every((movie) => movie?.runtime)
                ? movies.reduce((sum, movie) => sum + movie!.runtime!, 0) / MINUTES_PER_HOUR
                : null,
        topGenre: getMostFrequent(movies.map((movie) => movie?.genres)),
        topDirector: getMostFrequent(
            movies.map((movie) => movie?.directors?.map((person) => person.name)),
        ),
        topActor: getMostFrequent(movies.map((movie) => movie?.cast?.map((person) => person.name))),
    };
}

function getMostFrequent(screenings: (string[] | null | undefined)[]): string | null {
    if (screenings.some((values) => !values?.length)) return null;
    const values = screenings.flatMap((value) => value ?? []);
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return (
        [...counts].sort(
            ([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b),
        )[0]?.[0] ?? null
    );
}
