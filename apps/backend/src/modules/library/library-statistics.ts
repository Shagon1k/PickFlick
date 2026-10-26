import { movieDetailsSchema, type TLibraryStatistics } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

const MINUTES_PER_HOUR = 60;

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
    const movies = ratings.map(({ movie }) => {
        const parsed = movieDetailsSchema.safeParse(movie.details[0]?.data);
        return parsed.success ? parsed.data : null;
    });
    return {
        filmsRated: ratings.length,
        ratedThisYear: ratings.filter(
            (rating) => rating.updatedAt.getUTCFullYear() === now.getUTCFullYear(),
        ).length,
        averageRating: ratings.length
            ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
            : null,
        totalWatchHours: movies.every((movie) => movie?.runtime)
            ? movies.reduce((sum, movie) => sum + movie!.runtime!, 0) / MINUTES_PER_HOUR
            : null,
        watchlistCount,
        favoriteGenre: getMostFrequent(movies.map((movie) => movie?.genres)),
        topDirector: getMostFrequent(
            movies.map((movie) => movie?.directors?.map((person) => person.name)),
        ),
        topActor: getMostFrequent(movies.map((movie) => movie?.cast?.map((person) => person.name))),
    };
}

function getMostFrequent(movies: (string[] | null | undefined)[]): string | null {
    if (movies.some((values) => !values?.length)) return null;
    const counts = new Map<string, number>();
    for (const values of movies) {
        for (const value of new Set(values)) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    // Exact cached names are the identity available in our catalog contract. Code-unit order
    // breaks equal counts consistently without relying on the host's collation or input order.
    return (
        [...counts].sort(
            ([a, aCount], [b, bCount]) => bCount - aCount || (a < b ? -1 : 1),
        )[0]?.[0] ?? null
    );
}
