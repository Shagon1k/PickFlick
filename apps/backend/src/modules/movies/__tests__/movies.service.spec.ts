import { Test } from '@nestjs/testing';

import { RUNTIME_ENVIRONMENT } from '../../../config/runtime.module.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
    canonicalDetails,
    MOVIE_ID,
    movieDetails,
    movieLookup,
} from '../../../testing/movie-fixtures.js';
import { MoviesRepository } from '../movies.repository.js';
import { MoviesService } from '../movies.service.js';
import {
    MOVIE_PROVIDER,
    MovieProviderError,
    type TProviderRecord,
    type TProviderSearch,
} from '../providers/movie-provider.js';

describe('MoviesService', () => {
    const provider = {
        search: vi.fn<() => Promise<TProviderSearch>>(),
        details: vi.fn<() => Promise<TProviderRecord>>(),
    };
    const repository = {
        cachedSearch: vi.fn<MoviesRepository['cachedSearch']>(),
        cachedDetails: vi.fn<MoviesRepository['cachedDetails']>(),
        saveSearch: vi.fn<MoviesRepository['saveSearch']>(),
        saveDetails: vi.fn<MoviesRepository['saveDetails']>(),
        lookup: vi.fn<MoviesRepository['lookup']>(),
    };
    const database = { movie: { findMany: vi.fn() } };
    const environment = {
        catalog: { provider: 'tmdb', locale: 'en-US', refreshHours: 24, staleHours: 168 },
    };
    let service: MoviesService;
    const now = new Date('2026-10-09T12:00:00Z');
    const old = new Date('2026-10-07T12:00:00Z');
    const search = { query: 'film', page: 1, locale: 'en-US' } as const;
    const emptySearch = { movies: [], page: 1, totalPages: 0, totalResults: 0 };

    beforeEach(async () => {
        vi.resetAllMocks();
        environment.catalog.provider = 'tmdb';
        vi.useFakeTimers();
        vi.setSystemTime(now);
        repository.cachedDetails.mockResolvedValue(null);
        repository.cachedSearch.mockResolvedValue(null);
        repository.lookup.mockResolvedValue(movieLookup());
        repository.saveDetails.mockImplementation((_id, _key, record) =>
            Promise.resolve({
                ...canonicalDetails(),
                ...record.data,
                provenance: record.provenance,
            }),
        );
        repository.saveSearch.mockImplementation((_key, data) =>
            Promise.resolve({ ...data, movies: [] }),
        );
        const moduleRef = await Test.createTestingModule({
            providers: [
                MoviesService,
                { provide: PrismaService, useValue: database },
                { provide: MOVIE_PROVIDER, useValue: provider },
                { provide: MoviesRepository, useValue: repository },
                { provide: RUNTIME_ENVIRONMENT, useValue: environment },
            ],
        }).compile();
        service = moduleRef.get(MoviesService);
    });

    afterEach(() => vi.useRealTimers());

    it('should read nomination summaries from Movie rows without calling a provider', async () => {
        database.movie.findMany.mockResolvedValue([
            { id: MOVIE_ID, title: 'Stored title', releaseYear: 2026 },
        ]);
        const summaries = await service.cachedSummaries(database as unknown as PrismaService, [
            MOVIE_ID,
            'missing',
        ]);
        expect([...summaries.values()]).toEqual([
            { id: MOVIE_ID, title: 'Stored title', year: 2026 },
            { id: 'missing', title: null, year: null },
        ]);
        expect(provider.details).not.toHaveBeenCalled();
        expect(provider.search).not.toHaveBeenCalled();
    });

    it('should return backend-built IMDb links without exposing identifiers', async () => {
        repository.cachedDetails.mockResolvedValue({ data: canonicalDetails(), fetchedAt: now });
        repository.lookup.mockResolvedValue({
            externalIds: [{ source: 'imdb', externalId: 'tt0000100' }],
        });
        expect(await service.detailsResponse(MOVIE_ID)).toMatchObject({
            result: { state: 'fresh', data: { id: MOVIE_ID } },
            links: { imdb: 'https://www.imdb.com/title/tt0000100/' },
        });
        repository.cachedDetails.mockResolvedValue(null);
        repository.lookup.mockResolvedValue(null);
        expect(await service.detailsResponse(MOVIE_ID)).toEqual({
            result: { state: 'unavailable', reason: 'NOT_FOUND' },
            links: { imdb: null },
        });
    });

    it('should return fresh details without calling the provider', async () => {
        repository.cachedDetails.mockResolvedValue({ data: canonicalDetails(), fetchedAt: now });
        expect(await service.details(MOVIE_ID)).toMatchObject({
            state: 'fresh',
            data: { id: MOVIE_ID },
        });
        expect(provider.details).not.toHaveBeenCalled();
    });

    it('should persist fetched details and return them as fresh', async () => {
        provider.details.mockResolvedValue(movieDetails());
        expect(await service.details(MOVIE_ID)).toMatchObject({
            state: 'fresh',
            fetchedAt: now.toISOString(),
        });
        expect(repository.saveDetails).toHaveBeenCalledWith(
            MOVIE_ID,
            expect.any(String),
            movieDetails(),
            now,
        );
    });

    it('should refresh a fresh Movie when explicitly forced', async () => {
        repository.cachedDetails.mockResolvedValue({ data: canonicalDetails(), fetchedAt: now });
        provider.details.mockResolvedValue(movieDetails());
        await service.details(MOVIE_ID, { forceRefresh: true });
        expect(provider.details).toHaveBeenCalledWith(movieLookup());
    });

    it('should report and cache partial details until the next refresh', async () => {
        const record = movieDetails();
        record.provenance.push({
            source: 'thetvdb',
            fetchedAt: null,
            reason: 'TIMEOUT',
            sections: ['metadata'],
        });
        provider.details.mockResolvedValue(record);
        const fetched = await service.details(MOVIE_ID);
        expect(fetched).toMatchObject({ state: 'partial' });
        if (fetched.state !== 'partial') throw new Error('expected partial details');
        repository.cachedDetails.mockResolvedValue({ data: fetched.data, fetchedAt: now });
        expect(await service.details(MOVIE_ID)).toMatchObject({ state: 'partial' });
        expect(provider.details).toHaveBeenCalledOnce();
    });

    it('should require opt-in before serving stale details', async () => {
        repository.cachedDetails.mockResolvedValue({ data: canonicalDetails(), fetchedAt: old });
        provider.details.mockRejectedValue(new MovieProviderError('TIMEOUT'));
        expect(await service.details(MOVIE_ID)).toMatchObject({
            state: 'unavailable',
            reason: 'TIMEOUT',
        });
        expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
            state: 'stale',
            reason: 'TIMEOUT',
            fetchedAt: old.toISOString(),
        });
    });

    it('should preserve the provider retry time in a stale response', async () => {
        const retryAt = new Date(now.getTime() + 60_000);
        repository.cachedDetails.mockResolvedValue({ data: canonicalDetails(), fetchedAt: old });
        provider.details.mockRejectedValue(new MovieProviderError('RATE_LIMITED', retryAt));
        expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
            state: 'stale',
            reason: 'RATE_LIMITED',
            retryAt: retryAt.toISOString(),
        });
    });

    it.each(['NOT_FOUND', 'AUTHENTICATION', 'INVALID_RESPONSE', 'DISABLED'] as const)(
        'should never use stale data after %s',
        async (reason) => {
            repository.cachedDetails.mockResolvedValue({
                data: canonicalDetails(),
                fetchedAt: old,
            });
            provider.details.mockRejectedValue(new MovieProviderError(reason));
            expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
                state: 'unavailable',
                reason,
            });
        },
    );

    it.each([new Date('2026-10-01T12:00:00Z'), new Date('2026-10-10T12:00:00Z')])(
        'should reject an expired or future cache %#',
        async (fetchedAt) => {
            repository.cachedDetails.mockResolvedValue({ data: canonicalDetails(), fetchedAt });
            provider.details.mockRejectedValue(new MovieProviderError('UNAVAILABLE'));
            expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
                state: 'unavailable',
            });
        },
    );

    it('should propagate persistence failure instead of calling it provider unavailability', async () => {
        provider.details.mockResolvedValue(movieDetails());
        repository.saveDetails.mockRejectedValue(new Error('database write failed'));
        await expect(service.details(MOVIE_ID)).rejects.toThrow('database write failed');
    });

    it('should keep search cache keys specific to trimmed query and page', async () => {
        provider.search.mockResolvedValue(emptySearch);
        await service.search({ ...search, query: ' film ' });
        await service.search(search);
        await service.search({ ...search, page: 2 });
        const calls = repository.saveSearch.mock.calls;
        expect(calls[0]?.[0]).toBe(calls[1]?.[0]);
        expect(calls[0]?.[0]).not.toBe(calls[2]?.[0]);
        expect(provider.search).toHaveBeenCalledWith(search);
    });

    it('should return explicit no-results and reuse a fresh search snapshot', async () => {
        repository.cachedSearch.mockResolvedValue({ data: emptySearch, fetchedAt: now });
        expect(await service.search({ ...search, query: 'unknown' })).toMatchObject({
            state: 'fresh',
            data: { movies: [] },
        });
        expect(provider.search).not.toHaveBeenCalled();
    });

    it('should expose stale search results only with explicit opt-in', async () => {
        repository.cachedSearch.mockResolvedValue({ data: emptySearch, fetchedAt: old });
        provider.search.mockRejectedValue(new MovieProviderError('UNAVAILABLE'));
        expect(await service.search(search)).toMatchObject({ state: 'unavailable' });
        expect(await service.search(search, true)).toMatchObject({ state: 'stale' });
    });

    it('should isolate search caches by the configured provider', async () => {
        provider.search.mockResolvedValue(emptySearch);
        await service.search(search);
        environment.catalog.provider = 'poiskkino-thetvdb';
        await service.search(search);
        const calls = repository.saveSearch.mock.calls;
        expect(calls[1]?.[0]).not.toBe(calls[0]?.[0]);
    });
});
