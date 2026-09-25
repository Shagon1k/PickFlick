import { CLUB_CONFLICT_REASONS } from '@pickflick/contracts';
import { describe, expect, it } from 'vitest';

import { clubFailureMessage } from '../club-errors';

describe('Club failure messages', () => {
    it('gives every conflict reason its own recovery copy', () => {
        const messages = CLUB_CONFLICT_REASONS.map((reason) => clubFailureMessage(409, reason));
        expect(new Set(messages).size).toBe(CLUB_CONFLICT_REASONS.length);
        expect(clubFailureMessage(409, 'ADMIN_CLUB_LIMIT_REACHED')).toContain(
            'most active Clubs your plan allows',
        );
    });

    it('keeps an unknown conflict and a validation failure distinct from an unknown outcome', () => {
        expect(clubFailureMessage(409, undefined)).toContain('changed since this page loaded');
        expect(clubFailureMessage(409, '__proto__')).toContain('changed since this page loaded');
        expect(clubFailureMessage(400, undefined)).toContain('rejected these values');
        expect(clubFailureMessage(503, undefined)).toContain('may have been applied');
    });
});
