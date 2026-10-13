import { movieLookup } from '../../../../testing/movie-fixtures.js';
import { CompositeMovieProvider } from '../composite.provider.js';
import { emptyMetadata, MovieProviderError, type TSourceSnapshot } from '../movie-provider.js';

describe('CompositeMovieProvider', () => {
    const primary = { search: vi.fn(), details: vi.fn<() => Promise<TSourceSnapshot>>() };
    const enrichment = { details: vi.fn<() => Promise<TSourceSnapshot>>() };
    const now = new Date('2026-10-09T12:00:00Z');
    let provider: CompositeMovieProvider;
    function record(source: 'poiskkino' | 'thetvdb'): TSourceSnapshot {
        return {
            source,
            locale: 'en-US',
            fetchedAt: now.toISOString(),
            similarExternalIds: null,
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
        vi.useFakeTimers();
        vi.setSystemTime(now);
        primary.details.mockResolvedValue(record('poiskkino'));
        enrichment.details.mockResolvedValue(record('thetvdb'));
        provider = new CompositeMovieProvider(primary, enrichment);
    });
    afterEach(() => vi.useRealTimers());
    it.each([false, true])(
        'should preserve available details after delayed primary, remote-ID and enrichment calls (timeout=%s)',
        async (timeout) => {
            const delay = (milliseconds: number) =>
                new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
            primary.details.mockImplementation(async () => {
                await delay(4000);
                return record('poiskkino');
            });
            enrichment.details.mockImplementation(async () => {
                await delay(4000);
                await delay(timeout ? 5000 : 4000);
                if (timeout) throw new MovieProviderError('TIMEOUT', undefined, 'thetvdb');
                return record('thetvdb');
            });
            const pending = provider.details(movieLookup());
            await vi.advanceTimersByTimeAsync(13_000);
            const result = await pending;
            expect(result.data.title).toBe(timeout ? 'English primary title' : 'English title');
            expect(result.provenance.find(({ source }) => source === 'thetvdb')?.reason).toBe(
                timeout ? 'TIMEOUT' : null,
            );
            expect(primary.details).toHaveBeenCalledOnce();
            expect(enrichment.details).toHaveBeenCalledOnce();
        },
    );

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
    it('should fail when neither source knows the Movie', async () => {
        primary.details.mockRejectedValue(
            new MovieProviderError('NOT_FOUND', undefined, 'poiskkino'),
        );
        enrichment.details.mockRejectedValue(
            new MovieProviderError('MISSING_EXTERNAL_ID', undefined, 'thetvdb'),
        );
        await expect(provider.details(movieLookup())).rejects.toMatchObject({
            reason: 'NOT_FOUND',
        });
    });
    it('should report a disabled enrichment source in provenance', async () => {
        enrichment.details.mockRejectedValue(
            new MovieProviderError('DISABLED', undefined, 'thetvdb'),
        );
        const result = await provider.details(movieLookup());
        expect(result.data.overview).toBeNull();
        expect(result.provenance[1]?.reason).toBe('DISABLED');
    });
});
