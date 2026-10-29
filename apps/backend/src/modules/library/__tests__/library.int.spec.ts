import { randomUUID } from 'node:crypto';

import { LIBRARY_PAGE_SIZE, librarySchema } from '@pickflick/contracts';

import {
    createUser,
    type ITestApi,
    loadIntegrationEnvironment,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';
import { buildCanonicalDetails } from '../../../testing/movie-fixtures.js';
import { buildDetailsCacheKey } from '../../movies/catalog-cache-key.js';

describe('Library', () => {
    let api: ITestApi;
    let users: string[];
    const movies = Array.from({ length: 28 }, (_, index) => ({
        id: randomUUID(),
        title: `Library film ${String(index).padStart(2, '0')}`,
        releaseYear: 2024,
    }));
    const untitled = { id: randomUUID(), title: null, releaseYear: null };
    const literal = { id: randomUUID(), title: '100%_film', releaseYear: 2000 };
    const hidden = { id: randomUUID(), title: 'Private film', releaseYear: 2025 };
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    beforeAll(async () => {
        api = await startTestApi();
        users = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        await api.prisma.movie.createMany({ data: [...movies, untitled, literal, hidden] });
        for (const userId of users) {
            const owned = userId === users[0] ? [...movies, untitled, literal] : [hidden];
            await api.prisma.personalMovieRating.createMany({
                data: owned.map((movie) => ({
                    userId,
                    movieId: movie.id,
                    score: 8,
                    source: 'PERSONAL',
                    updatedAt,
                })),
            });
            await api.prisma.watchlistItem.createMany({
                data: owned.map((movie) => ({
                    userId,
                    movieId: movie.id,
                    priority: 'HIGH',
                    addedAt: updatedAt,
                })),
            });
        }
        await api.prisma.watchlistItem.update({
            where: { userId_movieId: { userId: users[0]!, movieId: literal.id } },
            data: { priority: 'LOW' },
        });
        await api.prisma.personalMovieRating.update({
            where: { userId_movieId: { userId: users[0]!, movieId: literal.id } },
            data: { score: 4 },
        });
        const environment = loadIntegrationEnvironment();
        const key = buildDetailsCacheKey(environment.catalog.provider, environment.catalog.locale);
        await api.prisma.movieDetailsCache.create({
            data: {
                movieId: literal.id,
                key,
                fetchedAt: updatedAt,
                data: {
                    ...buildCanonicalDetails(100, updatedAt.toISOString(), literal.id),
                    genres: ['Drama'],
                },
            },
        });
        await api.prisma.movieDetailsCache.create({
            data: {
                movieId: untitled.id,
                key,
                fetchedAt: updatedAt,
                data: { genres: ['Obsolete cache'] },
            },
        });
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.deleteMany({
            where: { id: { in: [...movies, untitled, literal, hidden].map((movie) => movie.id) } },
        });
        await api.close();
    });
    async function read(query = '', index = 0) {
        const response = await api.request(`/library?${query}`, { userId: users[index] });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        return librarySchema.parse(await response.json());
    }

    it('should isolate both tabs and reject caller-supplied identities and malformed queries', async () => {
        for (const tab of ['my-ratings', 'watchlist']) {
            const own = await read(`tab=${tab}`, 1);
            expect(own.total).toBe(1);
            expect(own.items.map((item) => item.movieId)).toEqual([hidden.id]);
            expect((await read(`tab=${tab}&q=Private`)).items).toEqual([]);
            await api.expectStatus(401, `/library?tab=${tab}`);
        }
        for (const query of [
            `userId=${users[1]}`,
            'page=0',
            'page=-1',
            'page=1.5',
            'page=100001',
            'page=NaN',
            'tab=achievements',
            'sort=sql',
            'score=11',
            'priority=high',
            'q=a&q=b',
            `q=${'x'.repeat(201)}`,
        ]) {
            await api.expectStatus(400, `/library?${query}`, { userId: users[0] });
        }
    });

    it('should page tied rows deterministically, clamp stale bounds, and keep empty results bounded', async () => {
        const sortedIds = movies.map((movie) => movie.id).sort((a, b) => a.localeCompare(b));
        for (const tab of ['my-ratings', 'watchlist']) {
            const first = await read(`tab=${tab}&q=LIBRARY`);
            const second = await read(`tab=${tab}&q=LIBRARY&page=100000`);
            expect(first).toMatchObject({
                page: 1,
                pages: 2,
                pageSize: LIBRARY_PAGE_SIZE,
                total: 28,
            });
            expect(first.items.map((item) => item.movieId)).toEqual(sortedIds.slice(0, 25));
            expect(second).toMatchObject({ page: 2, total: 28 });
            expect(second.items.map((item) => item.movieId)).toEqual(sortedIds.slice(25));
            expect(await read(`tab=${tab}&q=missing&page=100000`)).toMatchObject({
                page: 1,
                pages: 1,
                total: 0,
                items: [],
            });
            expect(
                (await read(`tab=${tab}&q=Library&sort=title&page=2`)).items.map(
                    (item) => item.title,
                ),
            ).toEqual(movies.slice(25).map((movie) => movie.title));
            const byYear = await read(`tab=${tab}&sort=year&page=2`);
            expect(byYear.items.at(-1)).toMatchObject({ movieId: untitled.id, genres: [] });
            expect((await read(`tab=${tab}&sort=recent`)).items).toHaveLength(25);
        }
    });

    it('should combine literal title search with rating and priority filters and use only cached genres', async () => {
        const ratings = await read('q=100%25_&score=4&sort=title');
        expect(ratings.items).toMatchObject([{ movieId: literal.id, genres: ['Drama'], score: 4 }]);
        expect((await read('q=100%25_&score=8')).total).toBe(0);
        const watchlist = await read('tab=watchlist&priority=LOW');
        expect(watchlist.items).toMatchObject([
            { movieId: literal.id, priority: 'LOW', genres: ['Drama'] },
        ]);
        expect((await read('tab=watchlist&q=100%25_&priority=HIGH')).total).toBe(0);
        expect((await read('q=%25')).items.map((item) => item.movieId)).toEqual([literal.id]);
    });
});
