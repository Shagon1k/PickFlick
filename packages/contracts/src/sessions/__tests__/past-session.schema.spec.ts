import { randomUUID } from 'node:crypto';

import { createPastSessionSchema } from '../past-session.schema.js';

const minimal = {
    submissionId: randomUUID(),
    scheduledAt: '2020-01-01T00:00:00Z',
    location: 'Old cinema',
    movieId: randomUUID(),
    attendees: [],
};

describe('createPastSessionSchema', () => {
    it('should accept a minimal screening without attendees or ratings', () => {
        expect(createPastSessionSchema.parse(minimal)).toEqual({
            ...minimal,
            nominations: [],
            scoreMatrix: [],
        });
    });
    it('should preserve partial matrices, unknown cells and explicit zero independently of ratings', () => {
        const membershipId = randomUUID();
        const nominations = [
            { movieId: randomUUID(), nominatorMembershipId: randomUUID() },
            { movieId: randomUUID() },
        ];
        const input = {
            ...minimal,
            attendees: [{ membershipId }],
            nominations,
            scoreMatrix: [
                { membershipId, scores: [{ movieId: nominations[0]!.movieId, score: 0 }] },
            ],
        };
        expect(createPastSessionSchema.parse(input)).toEqual(input);
        expect(createPastSessionSchema.safeParse({ ...minimal, nominations }).success).toBe(true);
    });
    it('should reject duplicate Movies, malformed rows, foreign cells and fabricated provenance', () => {
        const membershipId = randomUUID();
        const movieId = randomUUID();
        const cell = { movieId, score: 3 };
        const row = { membershipId, scores: [cell] };
        const input = { ...minimal, attendees: [{ membershipId }], nominations: [{ movieId }] };
        for (const patch of [
            { nominations: [{ movieId }, { movieId, nominatorMembershipId: membershipId }] },
            { nominations: [movieId] },
            { nominations: [{ movieId, nominatorMembershipId: 'invalid' }] },
            { nominations: [{ movieId, nominatorMembershipId: null }] },
            { nominations: [{ movieId, submittedAt: minimal.scheduledAt }] },
            { scoreMatrix: [row, row] },
            { scoreMatrix: [{ ...row, membershipId: randomUUID() }] },
            { scoreMatrix: [{ ...row, scores: [cell, cell] }] },
            { scoreMatrix: [{ ...row, scores: [{ ...cell, movieId: randomUUID() }] }] },
            { scoreMatrix: [{ ...row, scores: [null] }] },
            { scoreMatrix: [{ ...row, scores: [{ ...cell, submittedAt: minimal.scheduledAt }] }] },
            ...[-1, 11, 2.5, '3', null].map((score) => ({
                scoreMatrix: [{ ...row, scores: [{ movieId, score }] }],
            })),
        ])
            expect(createPastSessionSchema.safeParse({ ...input, ...patch }).success).toBe(false);
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
            { submissionId: undefined },
            { submissionId: 'invalid' },
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
