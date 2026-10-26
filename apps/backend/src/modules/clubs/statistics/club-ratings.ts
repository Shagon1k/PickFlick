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
        };
        row.total += screening.ratings.reduce((sum, rating) => sum + rating.score, 0);
        row.count += screening.ratings.length;
        const date = screening.scheduledAt?.getTime() ?? null;
        if (date !== null && (row.latest === null || date > row.latest)) row.latest = date;
        movies.set(row.movie.id, row);
    }
    const rows = [...movies.values()].sort((a, b) => compareMovies(a, b, query.sort));
    const pages = Math.max(1, Math.ceil(rows.length / CLUB_RATINGS_PAGE_SIZE));
    const page = Math.min(query.page, pages);
    return {
        analytics: 'EXTENDED',
        items: rows
            .slice((page - 1) * CLUB_RATINGS_PAGE_SIZE, page * CLUB_RATINGS_PAGE_SIZE)
            .map((row) => ({
                movieId: row.movie.id,
                title: row.movie.title,
                year: row.movie.releaseYear,
                genres: metadata.get(row.movie.id)?.genres ?? [],
                averageRating: row.total / row.count,
            })),
        total: rows.length,
        page,
        pages,
        pageSize: CLUB_RATINGS_PAGE_SIZE,
    };
}

function compareMovies(a: IRatedMovie, b: IRatedMovie, sort: TClubRatingsQuery['sort']) {
    let result: number;
    if (sort === 'rating') result = b.total / b.count - a.total / a.count;
    else if (sort === 'time') result = compareDates(a.latest, b.latest);
    else result = compareTitles(a.movie.title, b.movie.title);
    return result || a.movie.id.localeCompare(b.movie.id);
}

function compareDates(a: number | null, b: number | null) {
    if (a === null) return b === null ? 0 : 1;
    return b === null ? -1 : b - a;
}

function compareTitles(a: string | null, b: string | null) {
    if (a === null) return b === null ? 0 : 1;
    return b === null ? -1 : a.localeCompare(b, 'en');
}
