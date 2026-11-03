import {
    CLUB_RATINGS_PAGE_SIZE,
    type TClubRatings,
    type TClubRatingsQuery,
    type TMovieDetails,
} from '@pickflick/contracts';

import type { TCompletedScreening } from './completed-screenings.js';

interface IRatedMovie {
    movie: NonNullable<TCompletedScreening['movie']>;
    total: number;
    count: number;
    latest: number | null;
    genres: string[];
}

export function buildClubRatings(
    completed: TCompletedScreening[],
    metadata: Map<string, TMovieDetails>,
    query: TClubRatingsQuery,
): TClubRatings {
    const movies = new Map<string, IRatedMovie>();
    for (const screening of completed) {
        if (!screening.movie || !screening.ratings.length) continue;
        const row = movies.get(screening.movie.id) ?? {
            movie: screening.movie,
            total: 0,
            count: 0,
            latest: null,
            genres: metadata.get(screening.movie.id)?.genres ?? [],
        };
        row.total += screening.ratings.reduce((sum, rating) => sum + rating.score, 0);
        row.count += screening.ratings.length;
        const date = screening.scheduledAt?.getTime() ?? null;
        if (date !== null && (row.latest === null || date > row.latest)) row.latest = date;
        movies.set(row.movie.id, row);
    }
    // shortcut: every Completed Session is grouped, sorted and paged in memory. Fine for a Club's
    // screening history (hundreds of films); move sorting into SQL if Clubs reach thousands.
    const search = query.q?.toLocaleLowerCase('en') ?? '';
    const rows = [...movies.values()]
        .filter((row) => !search || row.movie.title?.toLocaleLowerCase('en').includes(search))
        .sort((a, b) => compareMovies(a, b, query));
    const pages = Math.max(1, Math.ceil(rows.length / CLUB_RATINGS_PAGE_SIZE));
    const page = Math.min(query.page, pages);
    return {
        items: rows
            .slice((page - 1) * CLUB_RATINGS_PAGE_SIZE, page * CLUB_RATINGS_PAGE_SIZE)
            .map((row) => ({
                movieId: row.movie.id,
                title: row.movie.title,
                year: row.movie.releaseYear,
                genres: row.genres,
                averageRating: row.total / row.count,
            })),
        total: rows.length,
        page,
        pages,
        pageSize: CLUB_RATINGS_PAGE_SIZE,
    };
}

function compareMovies(a: IRatedMovie, b: IRatedMovie, query: TClubRatingsQuery) {
    const direction =
        query.direction ?? (query.sort === 'title' || query.sort === 'genre' ? 'asc' : 'desc');
    let result: number;
    switch (query.sort) {
        case 'rating':
            result = compareValues(a.total / a.count, b.total / b.count, direction);
            break;
        case 'time':
            result = compareValues(a.latest, b.latest, direction);
            break;
        case 'year':
            result = compareValues(a.movie.releaseYear, b.movie.releaseYear, direction);
            break;
        case 'genre':
            result = compareValues(
                a.genres.join(', ') || null,
                b.genres.join(', ') || null,
                direction,
            );
            break;
        case 'title':
            result = compareValues(a.movie.title, b.movie.title, direction);
            break;
    }
    return result || a.movie.id.localeCompare(b.movie.id);
}

function compareValues(
    a: string | number | null,
    b: string | number | null,
    direction: 'asc' | 'desc',
) {
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    const result =
        typeof a === 'string' && typeof b === 'string'
            ? a.localeCompare(b, 'en')
            : Number(a) - Number(b);
    return direction === 'asc' ? result : -result;
}
