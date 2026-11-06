import { CLUB_CONFLICT_REASONS } from '@pickflick/contracts';

import { getFailureMessage } from '#lib/action-failure';
import { ApiError } from '#lib/api.server';

import { CLUB_FAILURE } from '../club-errors';

const messageFor = (status: number, reason?: string) =>
    getFailureMessage(new ApiError(status, undefined, reason), CLUB_FAILURE);

describe('CLUB_FAILURE', () => {
    it('should give every conflict reason its own recovery copy', () => {
        const messages = CLUB_CONFLICT_REASONS.map((reason) => messageFor(409, reason));

        expect(new Set(messages).size).toBe(CLUB_CONFLICT_REASONS.length);
        expect(messageFor(409, 'ADMIN_CLUB_LIMIT_REACHED')).toContain(
            'most active Clubs your plan allows',
        );
    });

    it('should keep unknown conflicts, validation failures, and outages distinct', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(messageFor(409)).toContain('changed since this page loaded');
        expect(messageFor(409, '__proto__')).toContain('changed since this page loaded');
        expect(messageFor(400)).toContain('rejected these values');
        expect(messageFor(503)).toContain('Reload to check');
        expect(getFailureMessage(new TypeError('fetch failed'), CLUB_FAILURE)).toContain(
            'Reload to check',
        );
    });
});
