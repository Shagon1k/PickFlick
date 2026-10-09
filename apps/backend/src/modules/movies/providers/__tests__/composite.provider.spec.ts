import { movieDetails, movieLookup } from '../../../../testing/movie-fixtures.js';
import { CompositeMovieProvider } from '../composite.provider.js';
import { emptyMetadata, MovieProviderError, type TSourceSnapshot } from '../movie-provider.js';

describe('CompositeMovieProvider', () => {
    const primary = {
        configurationKey: 'poiskkino:v1:enabled=true',
        enabled: true,
        search: vi.fn(),
        details: vi.fn<() => Promise<TSourceSnapshot>>(),
    };
    const enrichment = {
        configurationKey: 'thetvdb:v1:enabled=true',
        enabled: true,
        details: vi.fn<() => Promise<TSourceSnapshot>>(),
    };
    const cache = { cachedSources: vi.fn<() => Promise<TSourceSnapshot[]>>() };
    const now = new Date('2026-10-09T12:00:00Z');
    const old = new Date(now.getTime() - 48 * 3600000);
    let provider: CompositeMovieProvider;
    function record(source: 'poiskkino' | 'thetvdb', date = now): TSourceSnapshot {
        return {
            ...movieDetails(100, date.toISOString()).snapshots[0]!,
            source,
            externalIds: [
                { source, externalId: '100' },
                { source: 'imdb', externalId: 'tt0000100' },
            ],
            data:
                source === 'poiskkino'
                    ? {
                          ...emptyMetadata(),
                          title: 'English primary title',
                          posterUrl: 'https://image.openmoviedb.com/posters/synthetic.jpg',
                      }
                    : { ...emptyMetadata(), title: 'English title', overview: 'English overview' },
        };
    }
    beforeEach(() => {
        vi.resetAllMocks();
        cache.cachedSources.mockResolvedValue([]);
        primary.enabled = true;
        enrichment.enabled = true;
        vi.useFakeTimers();
        vi.setSystemTime(now);
        primary.details.mockResolvedValue(record('poiskkino'));
        enrichment.details.mockResolvedValue(record('thetvdb'));
        provider = new CompositeMovieProvider(
            primary,
            enrichment,
            {
                refreshHours: 24,
                staleHours: 168,
            },
            cache,
        );
    });
    afterEach(() => vi.useRealTimers());
    it('should search only through PoiskKino without requesting enrichment', async () => {
        primary.search.mockResolvedValue({ movies: [], page: 1, totalPages: 0, totalResults: 0 });
        expect(await provider.search({ query: 'film', page: 1, locale: 'en-US' })).toMatchObject({
            movies: [],
        });
        expect(enrichment.details).not.toHaveBeenCalled();
    });
    it('should use TVDB English metadata and primary media with explicit source provenance', async () => {
        const result = await provider.details({
            ...movieLookup(),
            externalIds: record('poiskkino').externalIds,
        });
        expect(result.data).toMatchObject({
            title: 'English title',
            overview: 'English overview',
            posterUrl: 'https://image.openmoviedb.com/posters/synthetic.jpg',
        });
        expect(result.provenance).toEqual([
            {
                source: 'poiskkino',
                fetchedAt: now.toISOString(),
                reason: null,
                sections: ['metadata', 'media', 'ratings', 'similar'],
            },
            {
                source: 'thetvdb',
                fetchedAt: now.toISOString(),
                reason: null,
                sections: ['metadata'],
            },
        ]);
    });
    it('should keep a missing English description null', async () => {
        enrichment.details.mockResolvedValue(record('thetvdb'));
        const english = record('thetvdb');
        english.data.overview = null;
        enrichment.details.mockResolvedValue(english);
        expect((await provider.details(movieLookup())).data.overview).toBeNull();
    });
    it('should reuse fresh enrichment with its original clock', async () => {
        const at = new Date(now.getTime() - 3600000);
        const cached = [record('thetvdb', at)];
        cache.cachedSources.mockResolvedValue(cached);
        const result = await provider.details(movieLookup());
        expect(enrichment.details).not.toHaveBeenCalled();
        expect(result.provenance[1]?.fetchedAt).toBe(at.toISOString());
    });
    it('should refresh enrichment when forced even if it is fresh', async () => {
        cache.cachedSources.mockResolvedValue([record('thetvdb')]);
        await provider.details({ ...movieLookup(), forceRefresh: true });
        expect(enrichment.details).toHaveBeenCalledOnce();
    });
    it('should expose enrichment failure and preserve primary data', async () => {
        enrichment.details.mockRejectedValue(
            new MovieProviderError('UNAVAILABLE', undefined, 'thetvdb'),
        );
        const result = await provider.details(movieLookup());
        expect(result.data).toMatchObject({
            overview: null,
            posterUrl: 'https://image.openmoviedb.com/posters/synthetic.jpg',
        });
        expect(result.provenance[1]).toMatchObject({
            source: 'thetvdb',
            fetchedAt: null,
            reason: 'UNAVAILABLE',
        });
    });
    it('should require opt-in and a transient failure for stale enrichment', async () => {
        enrichment.details.mockRejectedValue(
            new MovieProviderError('TIMEOUT', undefined, 'thetvdb'),
        );
        cache.cachedSources.mockResolvedValue([record('thetvdb', old)]);
        const lookup = movieLookup();
        expect((await provider.details(lookup)).data.overview).toBeNull();
        const stale = await provider.details({ ...lookup, allowStale: true });
        expect(stale.data.overview).toBe('English overview');
        expect(stale.provenance[1]).toMatchObject({
            fetchedAt: old.toISOString(),
            reason: 'TIMEOUT',
        });
    });
    it.each([
        'NOT_FOUND',
        'AUTHENTICATION',
        'INVALID_RESPONSE',
        'DISABLED',
        'IDENTITY_CONFLICT',
    ] as const)('should discard old enrichment after %s', async (reason) => {
        enrichment.details.mockRejectedValue(new MovieProviderError(reason, undefined, 'thetvdb'));
        cache.cachedSources.mockResolvedValue([record('thetvdb', old)]);
        const result = await provider.details({ ...movieLookup(), allowStale: true });
        expect(result.data.overview).toBeNull();
        expect(result.provenance[1]?.reason).toBe(reason);
    });
    it('should reject future or expired enrichment even with stale opt-in', async () => {
        enrichment.details.mockRejectedValue(
            new MovieProviderError('TIMEOUT', undefined, 'thetvdb'),
        );
        for (const at of [
            new Date(now.getTime() + 1000),
            new Date(now.getTime() - 169 * 3600000),
        ]) {
            cache.cachedSources.mockResolvedValue([record('thetvdb', at)]);
            expect(
                (
                    await provider.details({
                        ...movieLookup(),
                        allowStale: true,
                    })
                ).data.overview,
            ).toBeNull();
        }
    });
    it('should preserve the Movie from TVDB when the primary source is removed', async () => {
        primary.details.mockRejectedValue(
            new MovieProviderError('NOT_FOUND', undefined, 'poiskkino'),
        );
        const result = await provider.details(movieLookup());
        expect(result.data.title).toBe('English title');
        expect(result.provenance[0]).toMatchObject({ fetchedAt: null, reason: 'NOT_FOUND' });
    });
    it('should reject contradictory source IDs instead of matching title and year', async () => {
        const english = record('thetvdb');
        english.externalIds[1]!.externalId = 'tt9999999';
        enrichment.details.mockResolvedValue(english);
        await expect(provider.details(movieLookup())).rejects.toMatchObject({
            reason: 'IDENTITY_CONFLICT',
        });
    });
    it('should reuse each fresh source independently', async () => {
        cache.cachedSources.mockResolvedValue([record('poiskkino'), record('thetvdb')]);
        expect(
            (
                await provider.details({
                    ...movieLookup(),
                    externalIds: record('poiskkino').externalIds,
                })
            ).data.overview,
        ).toBe('English overview');
        expect(primary.details).not.toHaveBeenCalled();
        expect(enrichment.details).not.toHaveBeenCalled();
    });
    it('should discard cached enrichment when that source is disabled', async () => {
        enrichment.enabled = false;
        enrichment.details.mockRejectedValue(
            new MovieProviderError('DISABLED', undefined, 'thetvdb'),
        );
        cache.cachedSources.mockResolvedValue([record('thetvdb')]);
        const result = await provider.details(movieLookup());
        expect(result.data.overview).toBeNull();
        expect(result.provenance[1]?.reason).toBe('DISABLED');
    });
});
