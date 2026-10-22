import { movieDetailsSchema } from '@pickflick/contracts';

import type * as ApiModule from '../../lib/api.server';
import { ApiError, requestApi } from '../../lib/api.server';
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
        writers: null,
        budget: null,
        revenue: null,
        cast: null,
        trailers: null,
        provenance: [],
        similarMovieIds: null,
    });
}

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

vi.mock('../../lib/api.server', async (original) => ({
    ...(await original<typeof ApiModule>()),
    requestApi: vi.fn(),
}));

describe('getMovieDetails', () => {
    beforeEach(() => {
        vi.mocked(requestApi).mockReset();
    });

    it.each(['fresh', 'partial'] as const)(
        'should deliver %s details after sequential delayed provider calls exceed ten seconds',
        async (state) => {
            vi.useFakeTimers();
            const original = await vi.importActual<typeof ApiModule>('../../lib/api.server');
            vi.mocked(requestApi).mockImplementation(original.requestApi);
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
        vi.mocked(requestApi).mockRejectedValue(new TypeError('fetch failed'));
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'UNAVAILABLE',
        });
        vi.mocked(requestApi).mockRejectedValue(new ApiError(503));
        expect((await getMovieDetails(MOVIE_ID)).result.state).toBe('unavailable');
        vi.mocked(requestApi).mockRejectedValue(new ApiError(429));
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'RATE_LIMITED',
        });
        vi.mocked(requestApi).mockRejectedValue(new SyntaxError('invalid JSON'));
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'INVALID_RESPONSE',
        });
        vi.mocked(requestApi).mockRejectedValue(new ApiError(401));
        await expect(getMovieDetails(MOVIE_ID)).rejects.toMatchObject({ status: 401 });
    });
});
