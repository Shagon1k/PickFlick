import type { TLibraryQuery } from '@pickflick/contracts';
import { Prisma } from '@pickflick/database';

/** Prisma cannot order by joined genres inside the configured JSON details cache. */
export async function readGenrePage(
    tx: Prisma.TransactionClient,
    input: {
        userId: string;
        query: TLibraryQuery;
        detailsKey: string;
        skip: number;
        take: number;
    },
) {
    const { userId, query, detailsKey, skip, take } = input;
    const table =
        query.tab === 'watchlist' ? Prisma.sql`"WatchlistItem"` : Prisma.sql`"PersonalMovieRating"`;
    const direction = query.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const searchPattern = `%${query.q.replaceAll(/[\\%_]/gu, '\\$&')}%`;
    const title = query.q ? Prisma.sql`AND movie.title ILIKE ${searchPattern}` : Prisma.empty;
    let filter = Prisma.empty;
    if (query.tab === 'watchlist' && query.priority)
        filter = Prisma.sql`AND entry.priority = ${query.priority}::"WatchlistPriority"`;
    else if (query.tab === 'my-ratings' && query.score)
        filter = Prisma.sql`AND entry.score = ${Number(query.score)}`;
    const rows = await tx.$queryRaw<{ movieId: string }[]>`
        SELECT entry."movieId"
        FROM ${table} entry
        JOIN "Movie" movie ON movie.id = entry."movieId"
        LEFT JOIN "MovieDetailsCache" details
            ON details."movieId" = movie.id AND details.key = ${detailsKey}
        LEFT JOIN LATERAL (
            SELECT CASE WHEN bool_and(jsonb_typeof(genre.value) = 'string')
                THEN NULLIF(string_agg(genre.value #>> '{}', ', ' ORDER BY genre.ordinality), '')
                END AS label
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(details.data -> 'genres') = 'array'
                    THEN details.data -> 'genres' ELSE '[]'::jsonb END
            ) WITH ORDINALITY AS genre(value, ordinality)
        ) genres ON true
        WHERE entry."userId" = ${userId}::uuid ${title} ${filter}
        ORDER BY lower(genres.label) ${direction} NULLS LAST, entry."movieId" ASC
        OFFSET ${skip} LIMIT ${take}
    `;
    return rows.map(({ movieId }) => movieId);
}

export function orderGenrePage<TItem extends { movieId: string }>(items: TItem[], ids: string[]) {
    const position = new Map(ids.map((id, index) => [id, index]));
    return items.sort((a, b) => position.get(a.movieId)! - position.get(b.movieId)!);
}
