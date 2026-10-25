import { revalidatePath } from 'next/cache';

import { removeWatchlistItem, saveWatchlistItem } from '#api/watchlist.server';
import { ApiError } from '#lib/api.server';

import { setWatchlistAction } from '../actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('#api/watchlist.server', () => ({
    removeWatchlistItem: vi.fn(),
    saveWatchlistItem: vi.fn(),
}));

const MOVIE_ID = '10000000-0000-4000-8000-000000000037';

describe('setWatchlistAction', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should refresh Movie and Library after saves and repeated removals', async () => {
        expect(await setWatchlistAction(MOVIE_ID, 'HIGH')).toEqual({ ok: true });
        expect(saveWatchlistItem).toHaveBeenCalledWith(MOVIE_ID, { priority: 'HIGH' });
        expect(revalidatePath).toHaveBeenCalledWith(`/movies/${MOVIE_ID}`);
        expect(revalidatePath).toHaveBeenCalledWith('/library');
        expect(await setWatchlistAction(MOVIE_ID, null)).toEqual({ ok: true });
        expect(removeWatchlistItem).toHaveBeenCalledWith(MOVIE_ID);
    });

    it('should reject untrusted input before calling the API', async () => {
        const inputs: [string, unknown][] = [
            [MOVIE_ID, 'highest'],
            ['invalid', 'HIGH'],
            [MOVIE_ID, { priority: 'HIGH' }],
        ];
        for (const [id, priority] of inputs) {
            expect(await setWatchlistAction(id, priority)).toMatchObject({ ok: false });
        }
        expect(saveWatchlistItem).not.toHaveBeenCalled();
        expect(removeWatchlistItem).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('should give access recovery feedback without invalidating pages on a failed mutation', async () => {
        vi.mocked(saveWatchlistItem).mockRejectedValue(new ApiError(403));
        expect(await setWatchlistAction(MOVIE_ID, 'LOW')).toEqual({
            ok: false,
            message: 'Your Watchlist could not be changed. Refresh to check your access.',
        });
        expect(revalidatePath).not.toHaveBeenCalled();
        vi.mocked(removeWatchlistItem).mockRejectedValue(new ApiError(503));
        expect(await setWatchlistAction(MOVIE_ID, null)).toEqual({
            ok: false,
            message: 'We could not update your Watchlist. Try again.',
        });
    });
});
