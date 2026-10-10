import { movieDetailsSchema } from '@pickflick/contracts';

import type * as ApiModule from '../../lib/api.server';
import { ApiError, apiRequest } from '../../lib/api.server';
import { getMovieDetails } from '../movies.server';

const MOVIE_ID = '00000000-0000-4000-8000-000000000100';
function canonicalDetails() {
    return movieDetailsSchema.parse({
        id: MOVIE_ID,
        title: 'Synthetic film',
        originalTitle: null,
        overview: null,
        releaseDate: null,
        releaseYear: null,
        adult: false,
        originalLanguage: null,
        posterUrl: null,
        backdropUrl: null,
        ratings: [],
        runtime: null,
        genres: null,
        directors: null,
        cast: null,
        trailers: null,
        provenance: [],
        similarMovieIds: null,
    });
}

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

vi.mock('../../lib/api.server', async (original) => ({
    ...(await original<typeof ApiModule>()),
    apiRequest: vi.fn(),
}));

describe('getMovieDetails', () => {
    beforeEach(() => {
        vi.mocked(apiRequest).mockReset();
    });

    it('should validate the returned canonical identity and reject unsafe provider output', async () => {
        vi.mocked(apiRequest).mockResolvedValue({
            result: {
                state: 'fresh',
                data: canonicalDetails(),
                fetchedAt: '2026-10-10T12:00:00.000Z',
            },
            links: { imdb: null },
        });
        expect((await getMovieDetails(MOVIE_ID)).result.state).toBe('fresh');
        expect((await getMovieDetails('00000000-0000-4000-8000-000000000101')).result).toEqual({
            state: 'unavailable',
            reason: 'INVALID_RESPONSE',
        });
        vi.mocked(apiRequest).mockResolvedValue({
            result: {
                state: 'fresh',
                data: { ...canonicalDetails(), posterUrl: 'https://evil.invalid/poster.jpg' },
                fetchedAt: '2026-10-10T12:00:00.000Z',
            },
            links: { imdb: null },
        });
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'INVALID_RESPONSE',
        });
    });

    it('should accept stored image paths and backend-built links while rejecting provider URLs and unsafe links', async () => {
        const response = {
            result: {
                state: 'fresh',
                data: { ...canonicalDetails(), posterUrl: `/api/movies/images/${'a'.repeat(64)}` },
                fetchedAt: '2026-10-10T12:00:00.000Z',
            },
            links: { imdb: 'https://www.imdb.com/title/tt1234567/' },
        };
        vi.mocked(apiRequest).mockResolvedValue(response);
        expect(await getMovieDetails(MOVIE_ID)).toEqual(response);
        response.result.data.posterUrl = 'https://image.tmdb.org/t/p/original/synthetic.jpg';
        expect((await getMovieDetails(MOVIE_ID)).result.state).toBe('unavailable');
        response.result.data.posterUrl = `/api/movies/images/${'a'.repeat(64)}`;
        response.links.imdb = 'https://evil.invalid/title/tt1234567/';
        expect((await getMovieDetails(MOVIE_ID)).result.state).toBe('unavailable');
    });

    it.each(['fresh', 'partial'] as const)(
        'should deliver %s details after sequential delayed provider calls exceed ten seconds',
        async (state) => {
            vi.useFakeTimers();
            const original = await vi.importActual<typeof ApiModule>('../../lib/api.server');
            vi.mocked(apiRequest).mockImplementation(original.apiRequest);
            const response = {
                result: { state, data: canonicalDetails(), fetchedAt: '2026-10-10T12:00:00.000Z' },
                links: { imdb: null },
            };
            const deadline = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
                const controller = new AbortController();
                setTimeout(
                    () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
                    milliseconds,
                );
                return controller.signal;
            });
            const providerCalls = vi.fn();
            vi.stubGlobal(
                'fetch',
                vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
                    for (const delay of [4000, 4000, state === 'partial' ? 5000 : 4000]) {
                        providerCalls();
                        await new Promise<void>((resolve, reject) => {
                            setTimeout(resolve, delay);
                            init?.signal?.addEventListener(
                                'abort',
                                () => reject(new DOMException('Timed out', 'TimeoutError')),
                                { once: true },
                            );
                        });
                    }
                    return Response.json(response);
                }),
            );
            try {
                const pending = getMovieDetails(MOVIE_ID);
                await vi.advanceTimersByTimeAsync(13_000);
                expect(await pending).toEqual(response);
                expect(providerCalls).toHaveBeenCalledTimes(3);
                expect(deadline).toHaveBeenCalledWith(100_000);
            } finally {
                vi.useRealTimers();
                vi.restoreAllMocks();
                vi.unstubAllGlobals();
            }
        },
    );

    it('should expose transport failures while preserving authentication errors', async () => {
        vi.mocked(apiRequest).mockRejectedValue(new TypeError('fetch failed'));
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'UNAVAILABLE',
        });
        vi.mocked(apiRequest).mockRejectedValue(new ApiError(503));
        expect((await getMovieDetails(MOVIE_ID)).result.state).toBe('unavailable');
        vi.mocked(apiRequest).mockRejectedValue(new ApiError(429));
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'RATE_LIMITED',
        });
        vi.mocked(apiRequest).mockRejectedValue(new SyntaxError('invalid JSON'));
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'INVALID_RESPONSE',
        });
        vi.mocked(apiRequest).mockRejectedValue(new ApiError(401));
        await expect(getMovieDetails(MOVIE_ID)).rejects.toMatchObject({ status: 401 });
    });
});
