import { redirect } from 'next/navigation';

import { ApiError } from '#lib/api.server';

import { loadLibraryRead } from '../load-library-read';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
const RETURN_PATH = '/library?tab=achievements';

describe('loadLibraryRead', () => {
    it('should redirect unauthorized requests before applying recoverable-error handling', async () => {
        const redirected = new Error('redirect');
        vi.mocked(redirect).mockImplementationOnce(() => {
            throw redirected;
        });
        await expect(
            loadLibraryRead(() => Promise.reject(new ApiError(401)), RETURN_PATH),
        ).rejects.toBe(redirected);
        expect(redirect).toHaveBeenCalledWith('/login?returnTo=%2Flibrary%3Ftab%3Dachievements');
    });

    it.each([
        new ApiError(503),
        new TypeError('network'),
        new DOMException('timeout', 'TimeoutError'),
    ])('should recover each request independently: %s', async (error) => {
        await expect(
            Promise.all([
                loadLibraryRead(() => Promise.reject(error), RETURN_PATH),
                loadLibraryRead(() => Promise.resolve('available'), RETURN_PATH),
            ]),
        ).resolves.toEqual([null, 'available']);
    });

    it('should propagate unexpected errors', async () => {
        const error = new Error('unexpected');
        await expect(loadLibraryRead(() => Promise.reject(error), RETURN_PATH)).rejects.toBe(error);
    });
});
