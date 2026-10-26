import { clubRatingsQuerySchema } from '@pickflick/contracts';

import { buildClubRatings } from '../club-ratings.js';
import type { TCompletedScreening } from '../completed-screenings.js';

function screening(
    movieId: string,
    scores: number[],
    title: string | null = 'Film',
    date: string | null = null,
): TCompletedScreening {
    return {
        movieId,
        movie: { id: movieId, title, releaseYear: null },
        ratings: scores.map((score) => ({ score })),
        scheduledAt: date ? new Date(date) : null,
    };
}

describe('buildClubRatings', () => {
    it('should weight received ratings across repeat screenings and omit missing evidence', () => {
        const rows = [
            screening('a', [10, 2]),
            screening('a', [9]),
            screening('b', [9]),
            screening('c', []),
        ];
        const result = buildClubRatings(rows, new Map(), clubRatingsQuerySchema.parse({}));
        expect(result.items).toMatchObject([
            { movieId: 'b', averageRating: 9 },
            { movieId: 'a', averageRating: 7 },
        ]);
        expect(result.total).toBe(2);
        expect(
            buildClubRatings([...rows].reverse(), new Map(), clubRatingsQuerySchema.parse({})),
        ).toEqual(result);
    });

    it('should sort by title and latest known permitted screening with stable ties and missing values last', () => {
        const rows = [
            screening('b', [8], 'Beta', '2020-01-01Z'),
            screening('a', [8], 'Alpha', '2026-01-01Z'),
            screening('c', [8], null),
        ];
        for (const sort of ['rating', 'time', 'title']) {
            const result = buildClubRatings(
                rows,
                new Map(),
                clubRatingsQuerySchema.parse({ sort }),
            );
            expect(result.items.map(({ movieId }) => movieId)).toEqual(['a', 'b', 'c']);
        }
    });

    it('should bound pages, clamp stale pages and keep empty results on page one', () => {
        const rows = Array.from({ length: 27 }, (_, index) =>
            screening(String(index).padStart(2, '0'), [8]),
        );
        const result = buildClubRatings(
            rows,
            new Map(),
            clubRatingsQuerySchema.parse({ page: 100 }),
        );
        expect(result).toMatchObject({ page: 2, pages: 2, total: 27, pageSize: 25 });
        expect(result.items.map(({ movieId }) => movieId)).toEqual(['25', '26']);
        expect(
            buildClubRatings([], new Map(), clubRatingsQuerySchema.parse({ page: 100 })),
        ).toMatchObject({ page: 1, pages: 1, total: 0, items: [] });
    });
});
