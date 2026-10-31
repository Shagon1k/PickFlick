import { getFailureMessage, type IFailureCopy } from '../action-failure';
import { ApiError } from '../api.server';

const copy: IFailureCopy = {
    reasons: { CLUB_ARCHIVED: 'Archived.' },
    statuses: [
        [[403, 404], 'Access lost.'],
        [[404, 409], 'Changed.'],
    ],
    fallback: 'Try again.',
    request: 'Session update',
};

describe('getFailureMessage', () => {
    it('should prefer the stable reason over the status', () => {
        expect(getFailureMessage(new ApiError(409, 'CONFLICT', 'CLUB_ARCHIVED'), copy)).toBe(
            'Archived.',
        );
    });

    it('should ignore a reason that only matches an inherited property', () => {
        expect(getFailureMessage(new ApiError(409, 'CONFLICT', '__proto__'), copy)).toBe(
            'Changed.',
        );
    });

    it('should use the first status group that lists the status', () => {
        expect(getFailureMessage(new ApiError(404), copy)).toBe('Access lost.');
        expect(getFailureMessage(new ApiError(409, 'CONFLICT', 'UNKNOWN'), copy)).toBe('Changed.');
    });

    it('should log and fall back for unmapped API errors and network failures', () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(getFailureMessage(new ApiError(500), copy)).toBe('Try again.');
        expect(getFailureMessage(new TypeError('fetch failed'), copy)).toBe('Try again.');
        expect(log).toHaveBeenCalledWith('Session update failed.');
        log.mockRestore();
    });
});
