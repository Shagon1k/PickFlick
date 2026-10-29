import { randomUUID } from 'node:crypto';

import { librarySchema, watchlistItemSchema, watchlistResponseSchema } from '@pickflick/contracts';

import {
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';

describe('Watchlist', () => {
    let api: ITestApi;
    let users: string[];
    let movieId: string;
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        movieId = (
            await api.prisma.movie.create({
                data: { title: 'Watchlist screening', releaseYear: 2024 },
            })
        ).id;
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
    });
    afterAll(async () => {
        await api.close();
    });
    const read = (index = 0) =>
        api.request(`/movies/${movieId}/watchlist`, { userId: users[index] });
    const listMovieIds = async (index = 0) => {
        const response = await api.request('/library?tab=watchlist', { userId: users[index] });
        return librarySchema.parse(await response.json()).items.map((item) => item.movieId);
    };
    const save = (json: unknown = { priority: 'MEDIUM' }, index = 0) =>
        api.request(`/movies/${movieId}/watchlist`, { userId: users[index], method: 'PUT', json });
    const remove = (index = 0) =>
        api.request(`/movies/${movieId}/watchlist`, { userId: users[index], method: 'DELETE' });

    it('should preserve one item and its added date under concurrent adds, edits and retries', async () => {
        expect(watchlistResponseSchema.parse(await (await read()).json())).toEqual({ item: null });
        const adds = await Promise.all([save(), save(), save()]);
        expect(adds.map((response) => response.status)).toEqual([200, 200, 200]);
        const original = watchlistItemSchema.parse(await adds[0].json());
        expect(adds[0].headers.get('cache-control')).toBe('private, no-store');
        expect(watchlistItemSchema.parse(await adds[1].json())).toEqual(original);
        expect(watchlistItemSchema.parse(await adds[2].json())).toEqual(original);
        const edits = await Promise.all([save({ priority: 'HIGH' }), save({ priority: 'HIGH' })]);
        expect(edits.map((response) => response.status)).toEqual([200, 200]);
        for (const response of edits) {
            expect(watchlistItemSchema.parse(await response.json())).toEqual({
                ...original,
                priority: 'HIGH',
            });
        }
        expect(await listMovieIds()).toEqual([movieId]);
        expect(await api.prisma.watchlistItem.count({ where: { movieId } })).toBe(1);
        const removals = await Promise.all([remove(), remove()]);
        expect(removals.map((response) => response.status)).toEqual([204, 204]);
        expect(await (await read()).json()).toEqual({ item: null });
        expect(await listMovieIds()).toEqual([]);
        expect((await save({ priority: 'LOW' })).status).toBe(200);
        expect(await (await read()).json()).toMatchObject({ item: { priority: 'LOW' } });
    });

    it('should isolate reads, edits and deletes by the authenticated user', async () => {
        await save({ priority: 'HIGH' });
        expect(await (await read(1)).json()).toEqual({ item: null });
        expect(await listMovieIds(1)).toEqual([]);
        expect((await save({ priority: 'LOW', userId: users[0] }, 1)).status).toBe(400);
        expect((await save({ priority: 'LOW' }, 1)).status).toBe(200);
        expect(await (await read()).json()).toMatchObject({ item: { priority: 'HIGH' } });
        await api.request(`/movies/${movieId}/watchlist?userId=${users[0]}`, {
            userId: users[1],
            method: 'DELETE',
            json: { userId: users[0] },
        });
        expect(await (await read()).json()).toMatchObject({ item: { priority: 'HIGH' } });
        expect(await listMovieIds(1)).toEqual([]);
        expect(
            (
                await api.request(`/users/${users[0]}/watchlist/${movieId}`, {
                    userId: users[1],
                    method: 'DELETE',
                })
            ).status,
        ).toBe(404);
    });

    it('should reject malformed priorities and IDs, absent Movies and unauthenticated requests', async () => {
        for (const json of [
            {},
            { priority: 'high' },
            { priority: 1 },
            { priority: null },
            { priority: 'HIGH', movieId: randomUUID() },
        ]) {
            expect((await save(json)).status).toBe(400);
        }
        for (const method of ['GET', 'PUT', 'DELETE']) {
            expect(
                (
                    await api.request(`/movies/${movieId}/watchlist`, {
                        method,
                        json: method === 'PUT' ? { priority: 'HIGH' } : undefined,
                    })
                ).status,
            ).toBe(401);
            expect(
                (
                    await api.request('/movies/invalid/watchlist', {
                        userId: users[0],
                        method,
                        json: method === 'PUT' ? { priority: 'HIGH' } : undefined,
                    })
                ).status,
            ).toBe(400);
        }
        expect(
            (
                await api.request(`/movies/${randomUUID()}/watchlist`, {
                    userId: users[0],
                    method: 'PUT',
                    json: { priority: 'HIGH' },
                })
            ).status,
        ).toBe(404);
        expect(await api.prisma.watchlistItem.count({ where: { movieId } })).toBe(0);
    });

    it('should enforce uniqueness, priority and references in PostgreSQL and cascade private data', async () => {
        const data = { userId: users[0]!, movieId, priority: 'LOW' as const };
        await api.prisma.watchlistItem.create({ data });
        await expect(api.prisma.watchlistItem.create({ data })).rejects.toThrow();
        await expect(
            api.prisma.watchlistItem.create({ data: { ...data, userId: randomUUID() } }),
        ).rejects.toThrow();
        await expect(
            api.prisma.watchlistItem.create({ data: { ...data, movieId: randomUUID() } }),
        ).rejects.toThrow();
        await expect(
            api.prisma
                .$executeRaw`UPDATE "WatchlistItem" SET "priority" = 'INVALID' WHERE "userId" = ${users[0]}::uuid`,
        ).rejects.toThrow();
        await api.prisma.user.delete({ where: { id: users[0] } });
        expect(await api.prisma.watchlistItem.count({ where: { movieId } })).toBe(0);
        await save({ priority: 'HIGH' }, 1);
        await api.prisma.movie.delete({ where: { id: movieId } });
        expect(await api.prisma.watchlistItem.count({ where: { movieId } })).toBe(0);
        await api.prisma.movie.create({ data: { id: movieId } });
    });
});
