import { CLUB_CONFLICT_REASONS } from '@pickflick/contracts';

import { getClubFailureMessage } from '../club-errors';

describe('getClubFailureMessage', () => {
    it('should give every conflict reason its own recovery copy', () => {
        const messages = CLUB_CONFLICT_REASONS.map((reason) => getClubFailureMessage(409, reason));

        expect(new Set(messages).size).toBe(CLUB_CONFLICT_REASONS.length);
        expect(getClubFailureMessage(409, 'ADMIN_CLUB_LIMIT_REACHED')).toContain(
            'most active Clubs your plan allows',
        );
    });

    it('should keep unknown conflicts, validation failures, and outages distinct', () => {
        expect(getClubFailureMessage(409)).toContain('changed since this page loaded');
        expect(getClubFailureMessage(409, '__proto__')).toContain('changed since this page loaded');
        expect(getClubFailureMessage(400)).toContain('rejected these values');
        expect(getClubFailureMessage(503)).toContain('Reload to check');
    });
});
