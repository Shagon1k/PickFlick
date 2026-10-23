import { buildCanonicalDetails } from '../../../testing/movie-fixtures.js';
import { buildClubStatistics } from '../club-hub.js';

describe('buildClubStatistics', () => {
    it('should derive watch statistics from completed screenings and cached metadata without inventing ratings', () => {
        const movie = buildCanonicalDetails();
        const completed = [
            { movieId: movie.id, scheduledAt: new Date() },
            { movieId: movie.id, scheduledAt: new Date('2020-01-01Z') },
        ];
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
});
