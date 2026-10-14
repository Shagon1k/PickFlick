import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { buildCanonicalDetails, MOVIE_ID } from '../../../testing/movie-fixtures.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { AuthService } from '../../auth/auth.service.js';
import { MovieImagesService } from '../movie-images.service.js';
import { MoviesController } from '../movies.controller.js';
import { MoviesService } from '../movies.service.js';

describe('MoviesController', () => {
    let app: NestExpressApplication;
    let url: string;
    const detailsResponse = vi.fn<MoviesService['detailsResponse']>();
    const getImage = vi.fn<MovieImagesService['get']>();
    const storeMedia = vi.fn<MovieImagesService['storeMedia']>();
    const search = vi.fn<MoviesService['search']>();

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [MoviesController],
            providers: [
                AuthGuard,
                { provide: MovieImagesService, useValue: { get: getImage, storeMedia } },
                { provide: MoviesService, useValue: { search, detailsResponse } },
                {
                    provide: AuthService,
                    useValue: {
                        resolveUser: (headers: Record<string, unknown>) =>
                            headers['x-test-user'] ? { id: 'user' } : null,
                    },
                },
            ],
        }).compile();
        app = module.createNestApplication<NestExpressApplication>({ logger: false });
        app.useGlobalGuards(app.get(AuthGuard));
        await app.listen(0, '127.0.0.1');
        url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/movies/search`;
    });
    beforeEach(() => {
        search.mockReset();
        getImage.mockReset();
        storeMedia.mockReset();
        detailsResponse.mockReset();
    });
    afterAll(() => app.close());

    function request(body: unknown, isAuthenticated = true) {
        return fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(isAuthenticated ? { 'x-test-user': 'user' } : {}),
            },
            body: JSON.stringify(body),
        });
    }

    it('should guard details and validate canonical UUIDs before calling the service', async () => {
        const detailsUrl = url.replace('/search', '/00000000-0000-4000-8000-000000000100');
        expect((await fetch(detailsUrl)).status).toBe(401);
        expect(
            (await fetch(url.replace('/search', '/100'), { headers: { 'x-test-user': 'user' } }))
                .status,
        ).toBe(400);
        expect(detailsResponse).not.toHaveBeenCalled();
        detailsResponse.mockResolvedValue({
            result: { state: 'unavailable', reason: 'NOT_FOUND' },
            links: { imdb: null },
        });
        const response = await fetch(detailsUrl, { headers: { 'x-test-user': 'user' } });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(await response.json()).toEqual({
            result: { state: 'unavailable', reason: 'NOT_FOUND' },
            links: { imdb: null },
        });
        expect(detailsResponse).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000100');
    });

    it('should guard stored images, validate keys and serve bytes from storage', async () => {
        const key = 'a'.repeat(64);
        const imageUrl = url.replace('/search', `/images/${key}`);
        expect((await fetch(imageUrl)).status).toBe(401);
        expect(
            (
                await fetch(url.replace('/search', '/images/invalid'), {
                    headers: { 'x-test-user': 'user' },
                })
            ).status,
        ).toBe(400);
        expect(getImage).not.toHaveBeenCalled();
        getImage.mockResolvedValue({
            body: Buffer.from('synthetic-image'),
            contentType: 'image/png',
        });
        const response = await fetch(imageUrl, { headers: { 'x-test-user': 'user' } });
        expect(response.headers.get('content-type')).toBe('image/png');
        expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
        expect(await response.text()).toBe('synthetic-image');
        expect(getImage).toHaveBeenCalledWith(key);
    });

    it('should replace internal image URLs in successful detail responses', async () => {
        const data = buildCanonicalDetails();
        const stored = { ...data, posterUrl: `/api/movies/images/${'a'.repeat(64)}` };
        storeMedia.mockResolvedValue(stored);
        detailsResponse.mockResolvedValue({
            result: { state: 'fresh', data, fetchedAt: '2026-10-10T12:00:00.000Z' },
            links: { imdb: null },
        });
        const details = await fetch(url.replace('/search', `/${MOVIE_ID}`), {
            headers: { 'x-test-user': 'user' },
        });
        expect(await details.json()).toMatchObject({
            result: { data: { posterUrl: stored.posterUrl } },
            links: { imdb: null },
        });
        expect(storeMedia).toHaveBeenCalledWith(data);
    });

    it.each([{ state: 'fresh' }, { state: 'stale', reason: 'TIMEOUT' }] as const)(
        'should omit unused search media from $state results without ingestion',
        async (result) => {
            const data = {
                ...buildCanonicalDetails(),
                backdropUrl: 'https://image.tmdb.org/backdrop.jpg',
            };
            search.mockResolvedValue({
                ...result,
                data: { movies: [data], page: 1, totalPages: 1, totalResults: 1 },
                fetchedAt: '2026-10-10T12:00:00.000Z',
            });
            const response = await request({ query: 'Film' });
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                ...result,
                data: {
                    movies: [
                        { id: data.id, title: data.title, posterUrl: null, backdropUrl: null },
                    ],
                },
            });
            expect(storeMedia).not.toHaveBeenCalled();
            expect(getImage).not.toHaveBeenCalled();
        },
    );

    it('should return an eight-second search within its deadline despite three-second image ingestion', async () => {
        vi.useFakeTimers();
        try {
            const data = buildCanonicalDetails();
            search.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(
                            () =>
                                resolve({
                                    state: 'fresh',
                                    data: {
                                        movies: [data],
                                        page: 1,
                                        totalPages: 1,
                                        totalResults: 1,
                                    },
                                    fetchedAt: '2026-10-10T12:00:00.000Z',
                                }),
                            8000,
                        );
                    }),
            );
            storeMedia.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve(data), 3000);
                    }),
            );
            const response = Promise.race([
                app.get(MoviesController).search({ query: 'Film', page: 1, locale: 'en-US' }),
                new Promise((resolve) => setTimeout(() => resolve('deadline exceeded'), 10000)),
            ]);
            await vi.advanceTimersByTimeAsync(10000);
            expect(await response).toMatchObject({
                state: 'fresh',
                data: { movies: [{ id: data.id, posterUrl: null, backdropUrl: null }] },
            });
            expect(storeMedia).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('should reject anonymous search before calling the catalog', async () => {
        const response = await request({ query: 'Film' }, false);
        expect(response.status).toBe(401);
        expect(search).not.toHaveBeenCalled();
    });
    it.each([
        { query: '' },
        { query: 'x'.repeat(201) },
        { query: 'Film', page: 501 },
        { query: 'Film', extra: true },
    ])('should reject invalid search input %j', async (body) => {
        const response = await request(body);
        expect(response.status).toBe(400);
        expect(search).not.toHaveBeenCalled();
    });
    it('should return an explicit provider failure and opt into bounded stale results', async () => {
        search.mockResolvedValue({ state: 'unavailable', reason: 'RATE_LIMITED' });
        const response = await request({ query: ' Film ' });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(await response.json()).toEqual({ state: 'unavailable', reason: 'RATE_LIMITED' });
        expect(search).toHaveBeenCalledWith({ query: 'Film', page: 1, locale: 'en-US' }, true);
    });
});
