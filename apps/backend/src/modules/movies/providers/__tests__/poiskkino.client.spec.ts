import { PoiskkinoClient } from '../poiskkino.client.js';

describe('PoiskkinoClient', () => {
    const request = vi.fn<typeof fetch>();
    const client = () =>
        new PoiskkinoClient({ enabled: true, apiKey: 'synthetic-only', timeoutMs: 1000 }, request);
    const wire = () => ({
        id: 100,
        type: 'movie',
        name: 'Русское название',
        description: 'Русское описание',
        alternativeName: 'Непроверенный язык',
        enName: null,
        year: 2026,
        externalId: { imdb: 'tt0000100', tmdb: 100 },
        rating: { kp: 7.5 },
        votes: { kp: '1000' },
        poster: { url: 'https://image.openmoviedb.com/posters/synthetic.jpg' },
    });
    beforeEach(() => request.mockReset());
    it('should search through the documented endpoint and preserve a source title without inventing English metadata', async () => {
        request.mockResolvedValue(Response.json({ docs: [wire()], page: 1, pages: 1, total: 1 }));
        const result = await client().search({ query: 'film', page: 1, locale: 'en-US' });
        expect(result.movies[0]?.data).toMatchObject({
            title: 'Непроверенный язык',
            originalTitle: null,
            overview: null,
            originalLanguage: null,
            releaseDate: null,
            releaseYear: 2026,
            adult: null,
        });
        expect(request.mock.calls[0]?.[0]).toEqual(
            new URL('https://api.poiskkino.dev/v1.5/movie/search?query=film&page=1&limit=20'),
        );
        expect(request.mock.calls[0]?.[1]).toMatchObject({
            redirect: 'error',
            headers: { 'X-API-KEY': 'synthetic-only' },
        });
    });
    it.each([
        {
            enName: 'English title',
            alternativeName: 'Original title',
            name: 'Название',
            expected: 'English title',
        },
        { enName: '', alternativeName: 'Bat*21', name: 'Позывной Бэт-21', expected: 'Bat*21' },
        { enName: null, alternativeName: '', name: 'Название', expected: 'Название' },
        { enName: '', alternativeName: '', name: '', expected: null },
    ])(
        'should choose the first available display title: $expected',
        async ({ expected, ...names }) => {
            request.mockResolvedValue(
                Response.json({ docs: [{ ...wire(), ...names }], page: 1, pages: 1, total: 1 }),
            );
            const result = await client().search({ query: 'bat', page: 1, locale: 'en-US' });
            expect(result.movies[0]?.data.title).toBe(expected);
            expect(result.movies[0]?.data.overview).toBeNull();
        },
    );
    it('should preserve ratings with their source and scale and resolve similar external IDs', async () => {
        request.mockResolvedValue(
            Response.json({
                ...wire(),
                similarMovies: [{ id: 101 }],
                videos: {
                    trailers: [
                        { url: 'https://www.youtube.com/watch?v=abc123XYZ-_', name: 'Трейлер' },
                        { url: 'javascript:alert(1)' },
                    ],
                },
            }),
        );
        const result = await client().fetchDetails([{ source: 'poiskkino', externalId: '100' }]);
        expect(result.data.ratings).toEqual([
            { source: 'kinopoisk', value: 7.5, scale: 10, voteCount: 1000 },
        ]);
        expect(result.similarExternalIds).toEqual([[{ source: 'poiskkino', externalId: '101' }]]);
        expect(result.data.trailers).toHaveLength(1);
        expect(result.data.trailers?.[0]?.name).toBeNull();
    });
    it('should preserve unknown dates, ratings, language and content flags', async () => {
        request.mockResolvedValue(Response.json({ id: 100, type: 'movie', year: 0 }));
        const result = await client().fetchDetails([{ source: 'poiskkino', externalId: '100' }]);
        expect(result.data).toMatchObject({
            releaseDate: null,
            releaseYear: null,
            ratings: [],
            originalLanguage: null,
            adult: null,
        });
    });
    it('should exclude series without mistaking age classification for an adult flag', async () => {
        request.mockResolvedValue(
            Response.json({
                docs: [
                    wire(),
                    { ...wire(), id: 101, type: 'tv-series' },
                    { ...wire(), id: 102, ageRating: 18 },
                ],
                page: 1,
                pages: 1,
                total: 3,
            }),
        );
        expect(
            (await client().search({ query: 'film', page: 1, locale: 'en-US' })).movies,
        ).toHaveLength(2);
    });
    it('should keep search results when optional media uses an unsupported CDN', async () => {
        request.mockResolvedValueOnce(
            Response.json({
                docs: [
                    wire(),
                    {
                        ...wire(),
                        id: 101,
                        poster: {
                            url: 'https://cdnrrviubnyuntopbez5.svc.cdn.yandex.net/poster.jpg',
                        },
                        backdrop: { url: 'http://127.0.0.1/private.jpg' },
                    },
                ],
                page: 1,
                pages: 1,
                total: 2,
            }),
        );
        const result = await client().search({ query: 'bat', page: 1, locale: 'en-US' });
        expect(result.movies).toHaveLength(2);
        expect(result.movies[0]?.data.posterUrl).toBe(wire().poster.url);
        expect(result.movies[1]?.data).toMatchObject({ posterUrl: null, backdropUrl: null });
    });
    it('should omit unsafe image URLs from details', async () => {
        request.mockResolvedValueOnce(
            Response.json({
                ...wire(),
                poster: { url: 'https://image.openmoviedb.com.evil.invalid/a.jpg' },
            }),
        );
        const result = await client().fetchDetails([{ source: 'poiskkino', externalId: '100' }]);
        expect(result.data.posterUrl).toBeNull();
    });
    it('should reject unexpected movie IDs', async () => {
        request.mockResolvedValueOnce(Response.json({ ...wire(), id: 101 }));
        await expect(
            client().fetchDetails([{ source: 'poiskkino', externalId: '100' }]),
        ).rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
    });
    it('should avoid outbound requests when disabled', async () => {
        await expect(
            new PoiskkinoClient({ enabled: false, timeoutMs: 1000 }, request).fetchDetails([]),
        ).rejects.toMatchObject({ reason: 'DISABLED' });
        expect(request).not.toHaveBeenCalled();
    });
});
