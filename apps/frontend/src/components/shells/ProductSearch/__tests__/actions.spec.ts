import { searchMovies } from '@/api/movies.server';
import { ApiError } from '@/lib/api.server';

import { searchMoviesAction } from '../actions';

vi.mock('@/api/movies.server', () => ({ searchMovies: vi.fn() }));
vi.mock('@/lib/api.server', () => ({
    ApiError: class extends Error {
        constructor(public status: number) {
            super();
        }
    },
}));

describe('searchMoviesAction', () => {
    beforeEach(() => vi.resetAllMocks());
    it('should reject invalid input before requesting provider data', async () => {
        expect(await searchMoviesAction('x'.repeat(201))).toEqual({ state: 'invalid' });
        expect(searchMovies).not.toHaveBeenCalled();
    });
    it('should expose an expired session without provider data', async () => {
        vi.mocked(searchMovies).mockRejectedValue(new ApiError(401));
        expect(await searchMoviesAction('Film')).toEqual({ state: 'signed-out' });
    });
    it('should preserve provider failure states', async () => {
        vi.mocked(searchMovies).mockResolvedValue({ state: 'unavailable', reason: 'TIMEOUT' });
        expect(await searchMoviesAction(' Film ')).toEqual({
            state: 'unavailable',
            reason: 'TIMEOUT',
        });
        expect(searchMovies).toHaveBeenCalledWith({ query: 'Film', page: 1, locale: 'en-US' });
    });
    it('should translate unexpected transport failure to visible error', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.mocked(searchMovies).mockRejectedValue(new Error('Transport failed'));
        expect(await searchMoviesAction('Film')).toEqual({ state: 'error' });
        expect(log).toHaveBeenCalledWith('Movie search request failed.');
        log.mockRestore();
    });
});
