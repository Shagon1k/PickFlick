import { Test } from '@nestjs/testing';
import { movieSummarySchema } from '@pickflick/contracts';

import { RUNTIME_ENVIRONMENT } from '../../../config/runtime.module.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
    canonicalDetails,
    MOVIE_ID,
    movieDetails,
    movieLookup,
} from '../../../testing/movie-fixtures.js';
import { inspectDetailsCache, MoviesRepository } from '../movies.repository.js';
import { MoviesService } from '../movies.service.js';
import {
    MOVIE_PROVIDER,
    MovieProviderError,
    type TProviderRecord,
    type TProviderSearch,
} from '../providers/movie-provider.js';

describe('MoviesService', () => {
    const provider = {
        configurationKey: 'tmdb:v1',
        search: vi.fn<() => Promise<TProviderSearch>>(),
        details: vi.fn<() => Promise<TProviderRecord>>(),
    };
    const repository = {
        cachedSearch: vi.fn<MoviesRepository['cachedSearch']>(),
        cachedDetails: vi.fn<MoviesRepository['cachedDetails']>(),
        saveSearch: vi.fn<MoviesRepository['saveSearch']>(),
        saveDetails: vi.fn<MoviesRepository['saveDetails']>(),
        lookup: vi.fn<MoviesRepository['lookup']>(),
        markUnavailable: vi.fn<MoviesRepository['markUnavailable']>(),
    };
    const cache = {
        movieDetailsCache: { findMany: vi.fn() },
        movieSourceCache: { findMany: vi.fn() },
        movieSearchCache: { findMany: vi.fn() },
    };
    let database: PrismaService;
    let service: MoviesService;
    const now = new Date('2026-10-09T12:00:00Z');
    const old = new Date('2026-10-07T12:00:00Z');
    const cached = (value: Parameters<typeof inspectDetailsCache>[0]) =>
        inspectDetailsCache(value, { refreshHours: 24, staleHours: 168 });

    beforeEach(async () => {
        vi.resetAllMocks();
        provider.configurationKey = 'tmdb:v1';
        vi.useFakeTimers();
        vi.setSystemTime(now);
        repository.cachedDetails.mockResolvedValue(null);
        repository.lookup.mockResolvedValue(movieLookup());
        repository.cachedSearch.mockResolvedValue(null);
        cache.movieSearchCache.findMany.mockResolvedValue([]);
        repository.saveDetails.mockImplementation((_id, _key, data, fetchedAt) => {
            repository.cachedDetails.mockResolvedValue(
                cached({
                    data: { ...canonicalDetails(), ...data.data, provenance: data.provenance },
                    fetchedAt,
                }),
            );
            return Promise.resolve();
        });
        repository.saveSearch.mockImplementation((_key, data, fetchedAt) => {
            repository.cachedSearch.mockResolvedValue({ data: { ...data, movies: [] }, fetchedAt });
            return Promise.resolve();
        });
        const moduleRef = await Test.createTestingModule({
            providers: [
                MoviesService,
                { provide: PrismaService, useValue: cache },
                { provide: MOVIE_PROVIDER, useValue: provider },
                { provide: MoviesRepository, useValue: repository },
                {
                    provide: RUNTIME_ENVIRONMENT,
                    useValue: { catalog: { locale: 'en-US', refreshHours: 24, staleHours: 168 } },
                },
            ],
        }).compile();
        service = moduleRef.get(MoviesService);
        database = moduleRef.get(PrismaService);
    });

    afterEach(() => vi.useRealTimers());

    it('should derive cache-only summaries from validated details, source metadata or missing metadata', async () => {
        const source = movieDetails().snapshots[0]!;
        cache.movieDetailsCache.findMany.mockResolvedValue([
            { movieId: MOVIE_ID, data: { ...canonicalDetails(), title: 'Detail title' } },
            { movieId: 'invalid-details', data: { title: 'Invalid detail title' } },
        ]);
        cache.movieSourceCache.findMany.mockResolvedValue([
            { movieId: MOVIE_ID, data: source },
            {
                movieId: 'invalid-details',
                data: {
                    ...source,
                    data: { ...source.data, title: null, originalTitle: 'Original source title' },
                },
            },
            { movieId: 'invalid-source', data: { data: { title: 'Invalid source title' } } },
        ]);
        cache.movieSearchCache.findMany.mockResolvedValue([
            {
                data: {
                    movies: [movieSummarySchema.strip().parse(canonicalDetails())],
                    page: 1,
                    totalPages: 1,
                    totalResults: 1,
                },
            },
        ]);
        const summaries = await service.cachedSummaries(database, [
            MOVIE_ID,
            'invalid-details',
            'invalid-source',
            'missing',
        ]);
        expect([...summaries.values()]).toEqual([
            { id: MOVIE_ID, title: 'Detail title', year: 2026 },
            { id: 'invalid-details', title: 'Original source title', year: 2026 },
            { id: 'invalid-source', title: null, year: null },
            { id: 'missing', title: null, year: null },
        ]);
        expect(provider.details).not.toHaveBeenCalled();
        expect(provider.search).not.toHaveBeenCalled();
    });

    it('should use the newest validated search summary without a detail request', async () => {
        cache.movieDetailsCache.findMany.mockResolvedValue([]);
        cache.movieSourceCache.findMany.mockResolvedValue([]);
        const movie = movieSummarySchema.strip().parse(canonicalDetails());
        const data = { movies: [movie], page: 1, totalPages: 1, totalResults: 1 };
        cache.movieSearchCache.findMany.mockResolvedValue([
            { data: { ...data, movies: [{ id: MOVIE_ID, title: 'Invalid' }] } },
            { data: { ...data, movies: [{ ...movie, title: null }] } },
            { data: { ...data, movies: [{ ...movie, title: 'Older title' }] } },
        ]);
        expect([...(await service.cachedSummaries(database, [MOVIE_ID])).values()]).toEqual([
            { id: MOVIE_ID, title: 'Synthetic Movie', year: 2026 },
        ]);
        expect(provider.details).not.toHaveBeenCalled();
        expect(provider.search).not.toHaveBeenCalled();
    });

    it('should return backend-built IMDb links without exposing identifiers', async () => {
        repository.cachedDetails.mockResolvedValue(
            cached({ data: canonicalDetails(), fetchedAt: now }),
        );
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
        repository.cachedDetails.mockResolvedValue(
            cached({ data: canonicalDetails(), fetchedAt: now }),
        );
        expect(await service.details(MOVIE_ID)).toMatchObject({
            state: 'fresh',
            data: { id: MOVIE_ID },
        });
        expect(provider.details).not.toHaveBeenCalled();
    });

    it('should persist complete details and expose their freshness', async () => {
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
        repository.cachedDetails.mockResolvedValue(
            cached({ data: canonicalDetails(), fetchedAt: now }),
        );
        provider.details.mockResolvedValue(movieDetails());
        await service.details(MOVIE_ID, { forceRefresh: true });
        expect(provider.details).toHaveBeenCalledWith({ ...movieLookup(), forceRefresh: true });
    });

    it('should never return a successful response invalidated by a newer removal', async () => {
        provider.details.mockResolvedValue(movieDetails());
        repository.saveDetails.mockResolvedValue(undefined);
        expect(await service.details(MOVIE_ID)).toMatchObject({
            state: 'unavailable',
            reason: 'NOT_FOUND',
        });
    });

    it('should require opt-in before serving stale details', async () => {
        repository.cachedDetails.mockResolvedValue(
            cached({
                data: canonicalDetails(100, old.toISOString()),
                fetchedAt: old,
            }),
        );
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

    it('should preserve the provider retry time in a safe stale response', async () => {
        const retryAt = new Date(now.getTime() + 60_000);
        repository.cachedDetails.mockResolvedValue(
            cached({
                data: canonicalDetails(100, old.toISOString()),
                fetchedAt: old,
            }),
        );
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
            repository.cachedDetails.mockResolvedValue(
                cached({
                    data: canonicalDetails(100, old.toISOString()),
                    fetchedAt: old,
                }),
            );
            provider.details.mockRejectedValue(new MovieProviderError(reason));
            expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
                state: 'unavailable',
                reason,
            });
        },
    );

    it('should invalidate cached data when the provider removes a Movie', async () => {
        provider.details.mockRejectedValue(
            new MovieProviderError('NOT_FOUND', undefined, 'tmdb', [
                { source: 'tmdb', attemptedAt: now.toISOString() },
            ]),
        );
        await service.details(MOVIE_ID);
        expect(repository.markUnavailable).toHaveBeenCalledWith(MOVIE_ID, 'tmdb', now);
    });

    it('should recheck stale data after a concurrent request invalidates it', async () => {
        repository.cachedDetails
            .mockResolvedValueOnce(
                cached({
                    data: canonicalDetails(100, old.toISOString()),
                    fetchedAt: old,
                }),
            )
            .mockResolvedValueOnce(null);
        provider.details.mockRejectedValue(new MovieProviderError('TIMEOUT'));
        expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
            state: 'unavailable',
            reason: 'TIMEOUT',
        });
    });

    it.each([new Date('2026-10-01T12:00:00Z'), new Date('2026-10-10T12:00:00Z')])(
        'should reject unsafe cache age %#',
        async (fetchedAt) => {
            repository.cachedDetails.mockResolvedValue(
                cached({
                    data: canonicalDetails(100, fetchedAt.toISOString()),
                    fetchedAt,
                }),
            );
            provider.details.mockRejectedValue(new MovieProviderError('UNAVAILABLE'));
            expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
                state: 'unavailable',
            });
        },
    );

    it('should keep search cache keys specific to trimmed query and page', async () => {
        const data = { movies: [], page: 1, totalPages: 0, totalResults: 0 };
        provider.search.mockResolvedValue(data);
        await service.search({ query: ' film ', page: 1, locale: 'en-US' });
        repository.cachedSearch.mockResolvedValue(null);
        await service.search({ query: 'film', page: 1, locale: 'en-US' });
        repository.cachedSearch.mockResolvedValue(null);
        await service.search({ query: 'film', page: 2, locale: 'en-US' });
        const calls = repository.saveSearch.mock.calls;
        expect(calls[0]?.[0]).toBe(calls[1]?.[0]);
        expect(calls[0]?.[0]).not.toBe(calls[2]?.[0]);
        expect(provider.search).toHaveBeenCalledWith({ query: 'film', page: 1, locale: 'en-US' });
    });

    it('should return explicit no-results and reuse a fresh search snapshot', async () => {
        repository.cachedSearch.mockResolvedValue({
            data: { movies: [], page: 1, totalPages: 0, totalResults: 0 },
            fetchedAt: now,
        });
        expect(await service.search({ query: 'unknown', page: 1, locale: 'en-US' })).toMatchObject({
            state: 'fresh',
            data: { movies: [] },
        });
        expect(provider.search).not.toHaveBeenCalled();
    });

    it('should expose stale search results only with explicit opt-in', async () => {
        repository.cachedSearch.mockResolvedValue({
            data: { movies: [], page: 1, totalPages: 0, totalResults: 0 },
            fetchedAt: old,
        });
        provider.search.mockRejectedValue(new MovieProviderError('UNAVAILABLE'));
        expect(await service.search({ query: 'film', page: 1, locale: 'en-US' })).toMatchObject({
            state: 'unavailable',
        });
        expect(
            await service.search({ query: 'film', page: 1, locale: 'en-US' }, true),
        ).toMatchObject({
            state: 'stale',
        });
    });

    it('should propagate persistence failure instead of calling it provider unavailability', async () => {
        provider.details.mockResolvedValue(movieDetails());
        repository.saveDetails.mockRejectedValue(new Error('database write failed'));
        await expect(service.details(MOVIE_ID)).rejects.toThrow('database write failed');
    });
    it('should isolate search caches by active source configuration', async () => {
        provider.search.mockResolvedValue({ movies: [], page: 1, totalPages: 0, totalResults: 0 });
        await service.search({ query: 'film', page: 1, locale: 'en-US' });
        const firstKey = repository.saveSearch.mock.calls[0]?.[0];
        repository.cachedSearch.mockResolvedValue(null);
        provider.configurationKey = 'composite:v1:poiskkino:thetvdb';
        await service.search({ query: 'film', page: 1, locale: 'en-US' });
        expect(repository.saveSearch.mock.calls[1]?.[0]).not.toBe(firstKey);
    });
    it('should refresh details when one source is old even after a recent projection write', async () => {
        const data = canonicalDetails();
        data.provenance.push({
            source: 'thetvdb',
            fetchedAt: old.toISOString(),
            reason: null,
            sections: ['metadata'],
        });
        repository.cachedDetails.mockResolvedValue(cached({ data, fetchedAt: now }));
        provider.details.mockResolvedValue(movieDetails());
        await service.details(MOVIE_ID);
        expect(provider.details).toHaveBeenCalledOnce();
    });
    it('should reject unsafe stale source age after a recent primary update', async () => {
        const data = canonicalDetails();
        data.provenance.push({
            source: 'thetvdb',
            fetchedAt: '2026-10-01T12:00:00.000Z',
            reason: null,
            sections: ['metadata'],
        });
        repository.cachedDetails.mockResolvedValue(cached({ data, fetchedAt: now }));
        provider.details.mockRejectedValue(new MovieProviderError('TIMEOUT'));
        expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
            state: 'unavailable',
            reason: 'TIMEOUT',
        });
    });
    it('should expose partial enrichment and distinguish explicitly allowed stale enrichment', async () => {
        const record = movieDetails();
        record.provenance.push({
            source: 'thetvdb',
            fetchedAt: null,
            reason: 'TIMEOUT',
            sections: ['metadata'],
        });
        provider.details.mockResolvedValue(record);
        expect(await service.details(MOVIE_ID)).toMatchObject({ state: 'partial' });
        record.provenance[1]!.fetchedAt = old.toISOString();
        expect(await service.details(MOVIE_ID, { allowStale: true })).toMatchObject({
            state: 'stale',
            reason: 'TIMEOUT',
        });
    });
    it('should translate invalid normalized provider payloads to an explicit failure', async () => {
        provider.details.mockResolvedValue({
            ...movieDetails(),
            data: { ...movieDetails().data, posterUrl: 'https://evil.invalid/a.jpg' },
        });
        expect(await service.details(MOVIE_ID)).toMatchObject({
            state: 'unavailable',
            reason: 'INVALID_RESPONSE',
        });
    });
    it('should not return a concurrent stale projection to a caller without opt-in', async () => {
        provider.details.mockResolvedValue(movieDetails());
        const data = canonicalDetails();
        data.provenance.push({
            source: 'thetvdb',
            fetchedAt: old.toISOString(),
            reason: 'TIMEOUT',
            sections: ['metadata'],
        });
        repository.saveDetails.mockImplementation(() => {
            repository.cachedDetails.mockResolvedValue(cached({ data, fetchedAt: now }));
            return Promise.resolve();
        });
        expect(await service.details(MOVIE_ID)).toMatchObject({
            state: 'unavailable',
            reason: 'TIMEOUT',
        });
    });
});
