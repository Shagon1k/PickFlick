import type { Prisma } from '@pickflick/database';

import { buildCanonicalDetails } from '../../../testing/movie-fixtures.js';
import { buildLibraryStatistics } from '../library-statistics.js';

const NOW = new Date('2026-01-01T00:00:00Z');

function ratedMovie(score: number, updatedAt = NOW, data?: Prisma.JsonValue) {
    return {
        score,
        updatedAt,
        movie: { details: [{ data: data ?? buildCanonicalDetails() }] },
    };
}

describe('buildLibraryStatistics', () => {
    it('should reproduce all eight statistics from current opinions and UTC update dates', () => {
        const ratings = [
            ratedMovie(10),
            ratedMovie(8, new Date('2025-12-31T23:59:59Z')),
            ratedMovie(3, new Date('2025-12-31T23:30:00-01:00')),
        ];
        const expected = {
            filmsRated: 3,
            ratedThisYear: 2,
            averageRating: 7,
            totalWatchHours: 6,
            watchlistCount: 4,
            favoriteGenre: 'Drama',
            topDirector: 'Synthetic Director',
            topActor: 'Synthetic Actor',
        };
        expect(buildLibraryStatistics(ratings, 4, NOW)).toEqual(expected);
        expect(buildLibraryStatistics([...ratings].reverse(), 4, NOW)).toEqual(expected);
        expect(buildLibraryStatistics(ratings, 4, NOW)).toEqual(expected);
    });

    it('should return honest empty values without inventing ratings or favorites', () => {
        expect(buildLibraryStatistics([], 2, NOW)).toEqual({
            filmsRated: 0,
            ratedThisYear: 0,
            averageRating: null,
            totalWatchHours: 0,
            watchlistCount: 2,
            favoriteGenre: null,
            topDirector: null,
            topActor: null,
        });
    });

    it('should count a name once per film and break ties by exact code-unit order', () => {
        const first = {
            ...buildCanonicalDetails(),
            genres: ['Zebra', 'Zebra', 'Alpha'],
            directors: [{ name: 'Zebra' }, { name: 'Zebra' }, { name: 'Alpha' }],
            cast: ['Zebra', 'Zebra', 'Alpha'].map((name) => ({
                name,
                character: null,
                profileUrl: null,
            })),
        };
        const ratings = [ratedMovie(8, NOW, first), ratedMovie(6)];
        for (const ordered of [ratings, [...ratings].reverse()]) {
            expect(buildLibraryStatistics(ordered, 0, NOW)).toMatchObject({
                favoriteGenre: 'Alpha',
                topDirector: 'Alpha',
                topActor: 'Alpha',
            });
        }
    });

    it('should leave each incomplete metadata summary unavailable independently', () => {
        const metadata = buildCanonicalDetails();
        const first = ratedMovie(8);
        expect(
            buildLibraryStatistics(
                [first, ratedMovie(6, NOW, { ...metadata, runtime: null })],
                0,
                NOW,
            ),
        ).toMatchObject({ totalWatchHours: null, favoriteGenre: 'Drama' });
        expect(
            buildLibraryStatistics(
                [first, ratedMovie(6, NOW, { ...metadata, genres: [], directors: null })],
                0,
                NOW,
            ),
        ).toMatchObject({
            totalWatchHours: 4,
            favoriteGenre: null,
            topDirector: null,
            topActor: 'Synthetic Actor',
        });
        for (const details of [[], [{ data: { genres: ['Obsolete cache'] } }]]) {
            expect(
                buildLibraryStatistics(
                    [first, { score: 6, updatedAt: NOW, movie: { details } }],
                    0,
                    NOW,
                ),
            ).toMatchObject({
                filmsRated: 2,
                averageRating: 7,
                totalWatchHours: null,
                favoriteGenre: null,
                topDirector: null,
                topActor: null,
            });
        }
    });

    it('should recompute descriptive summaries after refresh without changing personal activity', () => {
        const ratings = [ratedMovie(8)];
        const before = buildLibraryStatistics(ratings, 3, NOW);
        ratings[0]!.movie.details[0]!.data = {
            ...buildCanonicalDetails(),
            runtime: 90,
            genres: ['Comedy'],
            directors: [{ name: 'New Director' }],
            cast: null,
        };
        const after = buildLibraryStatistics(ratings, 3, NOW);
        expect(after).toEqual({
            ...before,
            totalWatchHours: 1.5,
            favoriteGenre: 'Comedy',
            topDirector: 'New Director',
            topActor: null,
        });
        expect(buildLibraryStatistics(ratings, 3, NOW)).toEqual(after);
    });
});
