import { randomUUID } from 'node:crypto';

import { createPastSessionSchema } from '../past-session.schema.js';

const minimal = {
    scheduledAt: '2020-01-01T00:00:00Z',
    location: 'Old cinema',
    movieId: randomUUID(),
    attendees: [],
};

describe('createPastSessionSchema', () => {
    it('should accept a minimal screening without attendees or ratings', () => {
        expect(createPastSessionSchema.parse(minimal)).toEqual(minimal);
    });
    it('should validate optional evidence independently', () => {
        expect(
            createPastSessionSchema.safeParse({ ...minimal, topic: '', notes: '' }).success,
        ).toBe(true);
        for (const score of [0, 11, 1.5, null])
            expect(
                createPastSessionSchema.safeParse({
                    ...minimal,
                    attendees: [{ membershipId: randomUUID(), score }],
                }).success,
            ).toBe(false);
        expect(
            createPastSessionSchema.safeParse({
                ...minimal,
                attendees: [{ membershipId: randomUUID(), score: 10 }],
            }).success,
        ).toBe(true);
        expect(createPastSessionSchema.safeParse({ ...minimal, topic: 'one\ntwo' }).success).toBe(
            false,
        );
    });
    it('should reject future dates, missing Movies, repeated attendees and invented phases', () => {
        const attendee = { membershipId: randomUUID() };
        for (const input of [
            { scheduledAt: '2999-01-01T00:00:00Z' },
            { scheduledAt: 'not-a-date' },
            { movieId: null },
            { attendees: [attendee, attendee] },
            { deadlineAt: null },
            { phase: 'RATING' },
            { attendees: [{ ...attendee, submittedAt: '2020-01-01T00:00:00Z' }] },
        ])
            expect(createPastSessionSchema.safeParse({ ...minimal, ...input }).success).toBe(false);
    });
});
