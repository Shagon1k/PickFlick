import { CLUB_CONFLICT_REASONS } from '@pickflick/contracts';

import { clubFailureMessage } from '../club-errors';

describe('clubFailureMessage', () => {
    it('should give every conflict reason its own recovery copy', () => {
        const messages = CLUB_CONFLICT_REASONS.map((reason) => clubFailureMessage(409, reason));

        expect(new Set(messages).size).toBe(CLUB_CONFLICT_REASONS.length);
        expect(clubFailureMessage(409, 'ADMIN_CLUB_LIMIT_REACHED')).toContain(
            'most active Clubs your plan allows',
        );
    });

    it('should keep unknown conflicts, validation failures, and outages distinct', () => {
        expect(clubFailureMessage(409)).toContain('changed since this page loaded');
        expect(clubFailureMessage(409, '__proto__')).toContain('changed since this page loaded');
        expect(clubFailureMessage(400)).toContain('rejected these values');
        expect(clubFailureMessage(503)).toContain('Reload to check');
    });
});
