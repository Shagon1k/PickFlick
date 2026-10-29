import { randomUUID } from 'node:crypto';

import { libraryStatisticsSchema } from '@pickflick/contracts';

import {
    createUser,
    type ITestApi,
    loadIntegrationEnvironment,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';
import { buildCanonicalDetails } from '../../../testing/movie-fixtures.js';
import { buildDetailsCacheKey } from '../../movies/catalog-cache-key.js';

describe('Library statistics API', () => {
    let api: ITestApi;
    let users: string[];
    const movieIds = [randomUUID(), randomUUID()];
    const now = new Date();
    const previousYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    let key: string;
    beforeAll(async () => {
        api = await startTestApi();
        users = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        await api.prisma.movie.createMany({ data: movieIds.map((id) => ({ id })) });
        const environment = loadIntegrationEnvironment();
        key = buildDetailsCacheKey(environment.catalog.provider, environment.catalog.locale);
        await api.prisma.personalMovieRating.createMany({
            data: movieIds.map((movieId, index) => ({
                userId: users[0]!,
                movieId,
                score: index === 0 ? 10 : 4,
                source: index === 0 ? 'PERSONAL' : 'SESSION',
                updatedAt: index === 0 ? now : previousYear,
            })),
        });
        await api.prisma.watchlistItem.create({
            data: { userId: users[0]!, movieId: movieIds[0]!, priority: 'LOW' },
        });
        await api.prisma.movieDetailsCache.createMany({
            data: movieIds.map((movieId) => ({
                movieId,
                key,
                fetchedAt: now,
                data: buildCanonicalDetails(100, now.toISOString(), movieId),
            })),
        });
        // Another source/locale's metadata must not influence the configured projection.
        await api.prisma.movieDetailsCache.create({
            data: {
                movieId: movieIds[0]!,
                key: 'other-source',
                fetchedAt: now,
                data: { ...buildCanonicalDetails(), runtime: 1, genres: ['Wrong source'] },
            },
        });
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
        await api.close();
    });

    async function read(index = 0) {
        const response = await api.request('/library/statistics', { userId: users[index] });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        return libraryStatisticsSchema.parse(await response.json());
    }

    it('should isolate current users and reject anonymous and caller-selected identities', async () => {
        expect(await read()).toEqual({
            filmsRated: 2,
            ratedThisYear: 1,
            averageRating: 7,
            totalWatchHours: 4,
            watchlistCount: 1,
            favoriteGenre: 'Drama',
            topDirector: 'Synthetic Director',
            topActor: 'Synthetic Actor',
        });
        expect(await read(1)).toMatchObject({
            filmsRated: 0,
            ratedThisYear: 0,
            averageRating: null,
            totalWatchHours: 0,
            watchlistCount: 0,
            favoriteGenre: null,
        });
        await api.expectStatus(401, '/library/statistics');
        for (const query of [`userId=${users[0]}`, 'q=anything', 'page=1', 'tab=watchlist']) {
            await api.expectStatus(400, `/library/statistics?${query}`, { userId: users[1] });
        }
    });

    it('should recompute from only configured cached metadata and remain stable on repeated reads', async () => {
        const before = await read();
        expect(await read()).toEqual(before);
        await api.prisma.movieDetailsCache.updateMany({
            where: { movieId: { in: movieIds }, key },
            data: {
                data: {
                    ...buildCanonicalDetails(),
                    runtime: 90,
                    genres: ['Comedy'],
                    directors: null,
                    cast: [],
                },
            },
        });
        const changed = await read();
        expect(changed).toEqual({
            ...before,
            totalWatchHours: 3,
            favoriteGenre: 'Comedy',
            topDirector: null,
            topActor: null,
        });
        expect(await read()).toEqual(changed);
        await api.prisma.movieDetailsCache.deleteMany({ where: { movieId: movieIds[0], key } });
        expect(await read()).toEqual({ ...changed, totalWatchHours: null, favoriteGenre: null });
        await api.prisma.movieDetailsCache.updateMany({
            where: { movieId: movieIds[1], key },
            data: { data: { obsolete: true } },
        });
        expect(await read()).toEqual({ ...changed, totalWatchHours: null, favoriteGenre: null });
    });

    it('should reflect rating edits and watchlist retries without adding activity rows', async () => {
        const path = `/movies/${movieIds[1]}/personal-rating`;
        for (let retry = 0; retry < 2; retry++) {
            await api.expectStatus(200, path, {
                userId: users[0],
                method: 'PUT',
                json: { score: 8 },
            });
        }
        expect(await read()).toMatchObject({ filmsRated: 2, ratedThisYear: 2, averageRating: 9 });
        for (let retry = 0; retry < 2; retry++) {
            expect(
                (
                    await api.request(`/movies/${movieIds[1]}/watchlist`, {
                        userId: users[0],
                        method: 'PUT',
                        json: { priority: 'HIGH' },
                    })
                ).status,
            ).toBe(200);
        }
        const after = await read();
        expect(after).toMatchObject({ filmsRated: 2, watchlistCount: 2, averageRating: 9 });
        expect(await read()).toEqual(after);
    });
});
