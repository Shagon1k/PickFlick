import { movieLookup, tmdbDetails, tmdbMovie } from '../../../../testing/movie-fixtures.js';
import { MovieProviderError } from '../movie-provider.js';
import { TmdbClient } from '../tmdb.client.js';

describe('TmdbClient', () => {
    const settings = { enabled: true, readToken: 'synthetic-tmdb-read-token', timeoutMs: 1000 };
    const request = vi.fn<typeof fetch>();
    let client: TmdbClient;

    beforeEach(() => {
        request.mockReset();
        client = new TmdbClient(settings, request);
    });

    afterEach(() => vi.useRealTimers());

    it('should deduplicate search results and exclude adult Movies', async () => {
        request.mockResolvedValue(
            Response.json({
                page: 1,
                total_pages: 1,
                total_results: 3,
                results: [tmdbMovie(), tmdbMovie(), { ...tmdbMovie(101), adult: true }],
            }),
        );

        const result = await client.search({ query: ' & film ', page: 1, locale: 'en-US' });

        expect(result.movies).toHaveLength(1);
        expect(result.movies[0]).toMatchObject({
            externalIds: [{ source: 'tmdb', externalId: '100' }],
            data: {
                title: '<Synthetic Movie>',
                releaseDate: '2026-01-01',
            },
        });
        const call = request.mock.calls[0];
        expect(call?.[0]).toEqual(
            new URL(
                'https://api.themoviedb.org/3/search/movie?language=en-US&query=%26+film&page=1&include_adult=false',
            ),
        );
        expect(call?.[1]).toMatchObject({
            redirect: 'error',
            headers: { Authorization: 'Bearer synthetic-tmdb-read-token' },
        });
    });

    it('should map credits and allow only safe YouTube trailers', async () => {
        const response = tmdbDetails();
        response.credits.crew.push({ id: 3, name: 'Producer', job: 'Producer' });
        response.videos.results.push({
            key: '//evil.invalid',
            name: 'Unsafe',
            site: 'YouTube',
            type: 'Trailer',
            official: true,
        });
        response.videos.results.push({
            key: '123456789',
            name: 'Other',
            site: 'Vimeo',
            type: 'Trailer',
            official: false,
        });
        request.mockResolvedValue(Response.json(response));

        expect(await client.details(movieLookup(100))).toMatchObject({
            externalIds: [
                { source: 'tmdb', externalId: '100' },
                { source: 'imdb', externalId: 'tt1234567' },
            ],
            data: {
                runtime: 120,

                directors: [{ name: 'Synthetic Director' }],
                cast: [{ name: 'Synthetic Actor', character: 'Lead', profileUrl: null }],
                trailers: [{ url: 'https://www.youtube.com/watch?v=abc123XYZ-_' }],
            },
        });
        expect(request.mock.calls[0]?.[0]).toEqual(
            new URL(
                'https://api.themoviedb.org/3/movie/100?language=en-US&append_to_response=credits%2Cvideos%2Csimilar',
            ),
        );
    });

    it('should deduplicate related identifiers and exclude the current and adult movies', async () => {
        request.mockResolvedValue(
            Response.json({
                ...tmdbDetails(),
                similar: {
                    page: 1,
                    total_pages: 1,
                    total_results: 4,
                    results: [
                        tmdbMovie(),
                        tmdbMovie(101),
                        tmdbMovie(101),
                        { ...tmdbMovie(102), adult: true },
                    ],
                },
            }),
        );
        expect((await client.details(movieLookup(100))).similarExternalIds).toEqual([
            [{ source: 'tmdb', externalId: '101' }],
        ]);
    });

    it('should preserve absent release data and media as null', async () => {
        request.mockResolvedValue(
            Response.json({
                ...tmdbDetails(),
                release_date: '',
                runtime: null,
                imdb_id: null,
                poster_path: null,
            }),
        );

        expect(await client.details(movieLookup(100))).toMatchObject({
            data: { releaseDate: null, runtime: null, posterUrl: null },
        });
    });

    it.each([
        [400, 'INVALID_RESPONSE'],
        [401, 'AUTHENTICATION'],
        [403, 'AUTHENTICATION'],
        [404, 'NOT_FOUND'],
        [500, 'UNAVAILABLE'],
    ])('should translate HTTP %i without exposing provider content', async (status, reason) => {
        request.mockResolvedValue(new Response('untrusted provider text', { status }));
        await expect(client.details(movieLookup(100))).rejects.toMatchObject({ reason });
    });

    it('should reject payloads with the wrong identity or unsafe media paths', async () => {
        request.mockResolvedValueOnce(Response.json(tmdbDetails(101)));
        await expect(client.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'INVALID_RESPONSE',
        });
        request.mockResolvedValueOnce(
            Response.json({ ...tmdbDetails(), poster_path: '//evil.invalid/image.jpg' }),
        );
        await expect(client.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'INVALID_RESPONSE',
        });
    });

    it('should reject malformed JSON and incomplete detail payloads', async () => {
        request.mockResolvedValueOnce(new Response('{broken'));
        await expect(client.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'INVALID_RESPONSE',
        });
        request.mockResolvedValueOnce(Response.json(tmdbMovie()));
        await expect(client.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'INVALID_RESPONSE',
        });
    });

    it('should honor a rate-limit cooldown without issuing another request', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
        request.mockResolvedValue(
            new Response(null, { status: 429, headers: { 'Retry-After': '120' } }),
        );

        await expect(client.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'RATE_LIMITED',
            retryAt: new Date('2026-10-09T12:02:00Z'),
        });
        await expect(
            client.search({ query: 'film', page: 1, locale: 'en-US' }),
        ).rejects.toMatchObject({
            reason: 'RATE_LIMITED',
        });
        expect(request).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(120_001);
        request.mockResolvedValue(Response.json(tmdbDetails()));
        expect((await client.details(movieLookup(100))).externalIds[0]?.externalId).toBe('100');
    });

    it('should retain the longest cooldown from overlapping rate-limited requests', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
        const responses: ((response: Response) => void)[] = [];
        request.mockImplementation(
            () => new Promise<Response>((resolve) => responses.push(resolve)),
        );
        const longRequest = client.details(movieLookup(100)).catch((error: unknown) => error);
        const shortRequest = client.details(movieLookup(101)).catch((error: unknown) => error);
        expect(responses).toHaveLength(2);
        responses[0]?.(new Response(null, { status: 429, headers: { 'Retry-After': '120' } }));
        expect(await longRequest).toMatchObject({
            reason: 'RATE_LIMITED',
            retryAt: new Date('2026-10-09T12:02:00Z'),
        });
        responses[1]?.(new Response(null, { status: 429, headers: { 'Retry-After': '1' } }));
        expect(await shortRequest).toMatchObject({
            reason: 'RATE_LIMITED',
            retryAt: new Date('2026-10-09T12:02:00Z'),
        });

        await vi.advanceTimersByTimeAsync(1001);
        await expect(client.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'RATE_LIMITED',
        });
        expect(request).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(119_000);
        request.mockResolvedValue(Response.json(tmdbDetails()));
        expect((await client.details(movieLookup(100))).externalIds[0]?.externalId).toBe('100');
    });

    it('should accept a genre name at the canonical limit', async () => {
        const response = { ...tmdbDetails(), genres: [{ id: 1, name: 'x'.repeat(200) }] };
        request.mockResolvedValue(Response.json(response));
        expect((await client.details(movieLookup(100))).data.genres).toEqual(
            response.genres.map((genre) => genre.name),
        );
    });

    it('should translate a genre name exceeding the canonical limit to an invalid response', async () => {
        request.mockResolvedValue(
            Response.json({
                ...tmdbDetails(),
                genres: [{ id: 1, name: 'x'.repeat(201) }],
            }),
        );
        await expect(client.details(movieLookup(100))).rejects.toEqual(
            new MovieProviderError('INVALID_RESPONSE', undefined, 'tmdb'),
        );
    });

    it.each(['Fri, 09 Oct 2026 12:02:00 GMT', 'invalid'])(
        'should handle Retry-After %s',
        async (header) => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
            request.mockResolvedValue(
                new Response(null, { status: 429, headers: { 'Retry-After': header } }),
            );
            await expect(client.details(movieLookup(100))).rejects.toMatchObject({
                reason: 'RATE_LIMITED',
                retryAt: new Date(`2026-10-09T12:0${header === 'invalid' ? '1' : '2'}:00Z`),
            });
        },
    );

    it('should expose network failure without the raw error', async () => {
        request.mockRejectedValue(new Error('private provider diagnostics'));
        await expect(client.details(movieLookup(100))).rejects.toEqual(
            new MovieProviderError('UNAVAILABLE', undefined, 'tmdb'),
        );
    });

    it('should abort timed out provider requests', async () => {
        const shortTimeout = new TmdbClient({ ...settings, timeoutMs: 20 }, request);
        request.mockImplementation(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new Error('abort')), {
                        once: true,
                    });
                }),
        );
        await expect(shortTimeout.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'TIMEOUT',
        });
    });

    it('should remain unavailable without an enabled provider', async () => {
        const disabled = new TmdbClient({ enabled: false, timeoutMs: 1000 }, request);
        await expect(disabled.details(movieLookup(100))).rejects.toMatchObject({
            reason: 'DISABLED',
        });
        expect(request).not.toHaveBeenCalled();
    });
});
