import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AuthGuard } from '../../auth/auth.guard.js';
import { AuthService } from '../../auth/auth.service.js';
import { MoviesController } from '../movies.controller.js';
import { MoviesService } from '../movies.service.js';

describe('MoviesController', () => {
    let app: NestExpressApplication;
    let url: string;
    const detailsResponse = vi.fn<MoviesService['detailsResponse']>();
    const search = vi.fn<MoviesService['search']>();

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [MoviesController],
            providers: [
                AuthGuard,
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
        detailsResponse.mockReset();
    });
    afterAll(() => app.close());

    function request(body: unknown, authenticated = true) {
        return fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(authenticated ? { 'x-test-user': 'user' } : {}),
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
            externalIds: [],
        });
        const response = await fetch(detailsUrl, { headers: { 'x-test-user': 'user' } });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(await response.json()).toEqual({
            result: { state: 'unavailable', reason: 'NOT_FOUND' },
            externalIds: [],
        });
        expect(detailsResponse).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000100');
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
