import { buildCanonicalDetails } from '../../../../testing/movie-fixtures.js';
import { buildClubStatistics } from '../club-statistics.js';

describe('buildClubStatistics', () => {
    it('should derive watch statistics from completed screenings and cached metadata without inventing ratings', () => {
        const movie = buildCanonicalDetails();
        const completed = [
            {
                movieId: movie.id,
                movie: { id: movie.id, title: movie.title, releaseYear: movie.releaseYear },
                ratings: [],
                scheduledAt: new Date(),
            },
            {
                movieId: movie.id,
                movie: { id: movie.id, title: movie.title, releaseYear: movie.releaseYear },
                ratings: [],
                scheduledAt: new Date('2020-01-01Z'),
            },
        ];
        expect(buildClubStatistics(completed, new Map([[movie.id, movie]]), 'PRO')).toEqual({
            sessionsWatched: 2,
            sessionsThisYear: 1,
            averageRating: null,
            totalWatchHours: 4,
            topGenre: 'Drama',
            topDirector: 'Synthetic Director',
            topActor: 'Synthetic Actor',
        });
        expect(buildClubStatistics(completed, new Map(), 'PRO')).toMatchObject({
            sessionsWatched: 2,
            totalWatchHours: null,
            topGenre: null,
            topDirector: null,
            topActor: null,
        });
    });
});

describe('Club analytics tiers', () => {
    it('should expose only basic counters for Free and use UTC dates without inventing absent ratings', () => {
        const movie = buildCanonicalDetails();
        const completed = [
            {
                movieId: movie.id,
                movie: { id: movie.id, title: movie.title, releaseYear: movie.releaseYear },
                scheduledAt: new Date('2025-12-31T23:30:00-02:00'),
                ratings: [{ score: 10 }, { score: 2 }],
            },
        ];
        const now = new Date('2026-01-01Z');
        expect(buildClubStatistics(completed, new Map([[movie.id, movie]]), 'FREE', now)).toEqual({
            sessionsWatched: 1,
            sessionsThisYear: 1,
            averageRating: null,
            totalWatchHours: null,
            topGenre: null,
            topDirector: null,
            topActor: null,
        });
        expect(buildClubStatistics(completed, new Map(), 'PRO', now).averageRating).toBe(6);
        expect(buildClubStatistics([], new Map(), 'PRO', now)).toMatchObject({
            sessionsWatched: 0,
            sessionsThisYear: 0,
            averageRating: null,
            totalWatchHours: null,
        });
    });
});

describe('Cached metadata coverage', () => {
    it('should keep numeric history stable across metadata refresh and leave incomplete summaries unknown', () => {
        const movie = buildCanonicalDetails();
        const completed = [
            {
                movieId: movie.id,
                movie: { id: movie.id, title: movie.title, releaseYear: movie.releaseYear },
                ratings: [{ score: 8 }],
                scheduledAt: new Date('2026-01-01Z'),
            },
            { movieId: 'missing', movie: null, ratings: [{ score: 4 }], scheduledAt: null },
        ];
        const now = new Date('2026-06-01Z');
        const first = buildClubStatistics(completed, new Map([[movie.id, movie]]), 'PRO', now);
        expect(first).toMatchObject({
            sessionsWatched: 2,
            sessionsThisYear: 1,
            averageRating: 6,
            totalWatchHours: null,
            topGenre: null,
            topDirector: null,
            topActor: null,
        });
        const refreshed = { ...movie, runtime: 200, genres: ['Comedy'] };
        expect(
            buildClubStatistics(completed, new Map([[movie.id, refreshed]]), 'PRO', now),
        ).toEqual(first);
    });
});
