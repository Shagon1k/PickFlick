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
            externalIds: [],
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
            externalIds: [],
        });
        expect((await getMovieDetails(MOVIE_ID)).result).toEqual({
            state: 'unavailable',
            reason: 'INVALID_RESPONSE',
        });
    });

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
