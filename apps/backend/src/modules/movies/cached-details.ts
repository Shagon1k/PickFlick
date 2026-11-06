import { movieDetailsSchema, type TMovieDetails } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

const MINUTES_PER_HOUR = 60;

/** Parses one cached details row; an old cache shape is a miss, as on Movie Details. */
export function readCachedDetails(
    row: { data: Prisma.JsonValue } | undefined,
): TMovieDetails | null {
    const parsed = movieDetailsSchema.safeParse(row?.data);
    return parsed.success ? parsed.data : null;
}

/**
 * The name the most films share. Each film counts a name once; equal counts go to code-unit order,
 * which does not depend on the host's collation. One film without the field makes it unknown.
 */
function getMostFrequentName(films: (string[] | null | undefined)[]): string | null {
    if (films.some((names) => !names?.length)) return null;
    const counts = new Map<string, number>();
    for (const names of films) {
        for (const name of new Set(names)) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return (
        [...counts].sort(
            ([a, aCount], [b, bCount]) => bCount - aCount || (a < b ? -1 : 1),
        )[0]?.[0] ?? null
    );
}

/** Watch time estimates one viewing per film; one film without a runtime makes it unknown. */
export function getTotalWatchHours(films: (TMovieDetails | null | undefined)[]): number | null {
    if (!films.every((film) => film?.runtime)) return null;
    return films.reduce((sum, film) => sum + film!.runtime!, 0) / MINUTES_PER_HOUR;
}

/** Genre, director and actor summaries over the same films. */
export function summarizeFilms(films: (TMovieDetails | null | undefined)[]) {
    return {
        topGenre: getMostFrequentName(films.map((film) => film?.genres)),
        topDirector: getMostFrequentName(
            films.map((film) => film?.directors?.map((person) => person.name)),
        ),
        topActor: getMostFrequentName(
            films.map((film) => film?.cast?.map((person) => person.name)),
        ),
    };
}
