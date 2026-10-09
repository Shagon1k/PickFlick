import { Test } from '@nestjs/testing';
import type { TMovieDetails, TMovieSearchResults } from '@pickflick/contracts';

import { RUNTIME_ENVIRONMENT } from '../../../config/runtime.module.js';
import { movieDetails } from '../../../testing/movie-fixtures.js';
import { MOVIE_PROVIDER, MovieProviderError } from '../movie-provider.js';
import { MoviesRepository } from '../movies.repository.js';
import { MoviesService } from '../movies.service.js';

describe('MoviesService', () => {
    const provider = {
        search: vi.fn<() => Promise<TMovieSearchResults>>(),
        details: vi.fn<() => Promise<TMovieDetails>>(),
    };
    const repository = {
        cachedSearch: vi.fn<MoviesRepository['cachedSearch']>(),
        cachedDetails: vi.fn<MoviesRepository['cachedDetails']>(),
        saveSearch: vi.fn<MoviesRepository['saveSearch']>(),
        saveDetails: vi.fn<MoviesRepository['saveDetails']>(),
        markUnavailable: vi.fn<MoviesRepository['markUnavailable']>(),
    };
    let service: MoviesService;
    const now = new Date('2026-10-09T12:00:00Z');
    const old = new Date('2026-10-07T12:00:00Z');

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        repository.cachedDetails.mockResolvedValue(null);
        repository.cachedSearch.mockResolvedValue(null);
        repository.saveDetails.mockImplementation((data, fetchedAt) => {
            repository.cachedDetails.mockResolvedValue({ data, fetchedAt });
            return Promise.resolve();
        });
        repository.saveSearch.mockImplementation((_key, data, fetchedAt) => {
            repository.cachedSearch.mockResolvedValue({ data, fetchedAt });
            return Promise.resolve();
        });
        const moduleRef = await Test.createTestingModule({
            providers: [
                MoviesService,
                { provide: MOVIE_PROVIDER, useValue: provider },
                { provide: MoviesRepository, useValue: repository },
                {
                    provide: RUNTIME_ENVIRONMENT,
                    useValue: { tmdb: { refreshHours: 24, staleHours: 168 } },
                },
            ],
        }).compile();
        service = moduleRef.get(MoviesService);
    });

    afterEach(() => vi.useRealTimers());

    it('should return fresh details without calling the provider', async () => {
        repository.cachedDetails.mockResolvedValue({ data: movieDetails(), fetchedAt: now });
        expect(await service.details(100)).toMatchObject({ state: 'fresh', data: { tmdbId: 100 } });
        expect(provider.details).not.toHaveBeenCalled();
    });

    it('should persist complete details and expose their freshness', async () => {
        provider.details.mockResolvedValue(movieDetails());
        expect(await service.details(100)).toMatchObject({
            state: 'fresh',
            fetchedAt: now.toISOString(),
        });
        expect(repository.saveDetails).toHaveBeenCalledWith(movieDetails(), now);
    });

    it('should refresh a fresh Movie when explicitly forced', async () => {
        repository.cachedDetails.mockResolvedValue({ data: movieDetails(), fetchedAt: now });
        provider.details.mockResolvedValue(movieDetails());
        await service.details(100, { forceRefresh: true });
        expect(provider.details).toHaveBeenCalledWith(100);
    });

    it('should never return a successful response invalidated by a newer removal', async () => {
        provider.details.mockResolvedValue(movieDetails());
        repository.saveDetails.mockResolvedValue(undefined);
        expect(await service.details(100)).toMatchObject({
            state: 'unavailable',
            reason: 'NOT_FOUND',
        });
    });

    it('should require opt-in before serving stale details', async () => {
        repository.cachedDetails.mockResolvedValue({ data: movieDetails(), fetchedAt: old });
        provider.details.mockRejectedValue(new MovieProviderError('TIMEOUT'));
        expect(await service.details(100)).toMatchObject({
            state: 'unavailable',
            reason: 'TIMEOUT',
        });
        expect(await service.details(100, { allowStale: true })).toMatchObject({
            state: 'stale',
            reason: 'TIMEOUT',
            fetchedAt: old.toISOString(),
        });
    });

    it('should preserve the provider retry time in a safe stale response', async () => {
        const retryAt = new Date(now.getTime() + 60_000);
        repository.cachedDetails.mockResolvedValue({ data: movieDetails(), fetchedAt: old });
        provider.details.mockRejectedValue(new MovieProviderError('RATE_LIMITED', retryAt));
        expect(await service.details(100, { allowStale: true })).toMatchObject({
            state: 'stale',
            reason: 'RATE_LIMITED',
            retryAt: retryAt.toISOString(),
        });
    });

    it.each(['NOT_FOUND', 'AUTHENTICATION', 'INVALID_RESPONSE', 'DISABLED'] as const)(
        'should never use stale data after %s',
        async (reason) => {
            repository.cachedDetails.mockResolvedValue({ data: movieDetails(), fetchedAt: old });
            provider.details.mockRejectedValue(new MovieProviderError(reason));
            expect(await service.details(100, { allowStale: true })).toMatchObject({
                state: 'unavailable',
                reason,
            });
        },
    );

    it('should invalidate cached data when the provider removes a Movie', async () => {
        provider.details.mockRejectedValue(new MovieProviderError('NOT_FOUND'));
        await service.details(100);
        expect(repository.markUnavailable).toHaveBeenCalledWith(100, now);
    });

    it('should recheck stale data after a concurrent request invalidates it', async () => {
        repository.cachedDetails
            .mockResolvedValueOnce({ data: movieDetails(), fetchedAt: old })
            .mockResolvedValueOnce(null);
        provider.details.mockRejectedValue(new MovieProviderError('TIMEOUT'));
        expect(await service.details(100, { allowStale: true })).toMatchObject({
            state: 'unavailable',
            reason: 'TIMEOUT',
        });
    });

    it.each([new Date('2026-10-01T12:00:00Z'), new Date('2026-10-10T12:00:00Z')])(
        'should reject unsafe cache age %#',
        async (fetchedAt) => {
            repository.cachedDetails.mockResolvedValue({ data: movieDetails(), fetchedAt });
            provider.details.mockRejectedValue(new MovieProviderError('UNAVAILABLE'));
            expect(await service.details(100, { allowStale: true })).toMatchObject({
                state: 'unavailable',
            });
        },
    );

    it('should keep search cache keys specific to trimmed query and page', async () => {
        const data = { movies: [], page: 1, totalPages: 0, totalResults: 0 };
        provider.search.mockResolvedValue(data);
        await service.search({ query: ' film ', page: 1 });
        repository.cachedSearch.mockResolvedValue(null);
        await service.search({ query: 'film', page: 1 });
        repository.cachedSearch.mockResolvedValue(null);
        await service.search({ query: 'film', page: 2 });
        const calls = repository.saveSearch.mock.calls;
        expect(calls[0]?.[0]).toBe(calls[1]?.[0]);
        expect(calls[0]?.[0]).not.toBe(calls[2]?.[0]);
        expect(provider.search).toHaveBeenCalledWith({ query: 'film', page: 1 });
    });

    it('should return explicit no-results and reuse a fresh search snapshot', async () => {
        repository.cachedSearch.mockResolvedValue({
            data: { movies: [], page: 1, totalPages: 0, totalResults: 0 },
            fetchedAt: now,
        });
        expect(await service.search({ query: 'unknown', page: 1 })).toMatchObject({
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
        expect(await service.search({ query: 'film', page: 1 })).toMatchObject({
            state: 'unavailable',
        });
        expect(await service.search({ query: 'film', page: 1 }, true)).toMatchObject({
            state: 'stale',
        });
    });

    it('should propagate persistence failure instead of calling it provider unavailability', async () => {
        provider.details.mockResolvedValue(movieDetails());
        repository.saveDetails.mockRejectedValue(new Error('database write failed'));
        await expect(service.details(100)).rejects.toThrow('database write failed');
    });
});
