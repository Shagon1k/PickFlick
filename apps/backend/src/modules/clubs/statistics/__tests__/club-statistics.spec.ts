import { buildCanonicalDetails } from '../../../../testing/movie-fixtures.js';
import { buildClubStatistics } from '../club-statistics.js';

describe('buildClubStatistics', () => {
    const movie = buildCanonicalDetails();
    const screening = (scheduledAt: Date, ratings: { score: number }[] = []) => ({
        movieId: movie.id,
        movie: { id: movie.id, title: movie.title, releaseYear: movie.releaseYear },
        ratings,
        scheduledAt,
    });

    it('should derive watch statistics from completed screenings and cached metadata without inventing ratings', () => {
        const completed = [screening(new Date()), screening(new Date('2020-01-01Z'))];
        expect(buildClubStatistics(completed, new Map([[movie.id, movie]]))).toEqual({
            sessionsWatched: 2,
            sessionsThisYear: 1,
            averageRating: null,
            totalWatchHours: 4,
            topGenre: 'Drama',
            topDirector: 'Synthetic Director',
            topActor: 'Synthetic Actor',
        });
        expect(buildClubStatistics(completed, new Map())).toMatchObject({
            sessionsWatched: 2,
            totalWatchHours: null,
            topGenre: null,
            topDirector: null,
            topActor: null,
        });
    });

    describe('when counting dates and ratings', () => {
        it('should count the year in UTC and report no average without ratings', () => {
            const completed = [
                screening(new Date('2025-12-31T23:30:00-02:00'), [{ score: 10 }, { score: 2 }]),
            ];
            const now = new Date('2026-01-01Z');
            expect(buildClubStatistics(completed, new Map([[movie.id, movie]]), now)).toMatchObject(
                {
                    sessionsWatched: 1,
                    sessionsThisYear: 1,
                    averageRating: 6,
                },
            );
            expect(buildClubStatistics([], new Map(), now)).toMatchObject({
                sessionsWatched: 0,
                sessionsThisYear: 0,
                averageRating: null,
                totalWatchHours: null,
            });
        });
    });
});
