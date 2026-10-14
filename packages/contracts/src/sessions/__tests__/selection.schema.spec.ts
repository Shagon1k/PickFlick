import { submitSelectionSchema } from '../selection.schema.js';

const NOMINATION_ID = '00000000-0000-4000-8000-000000000001';

describe('submitSelectionSchema', () => {
    it.each([0, 1, 5, 10])('should accept integer score %i at the request boundary', (score) => {
        expect(
            submitSelectionSchema.safeParse({ scores: [{ nominationId: NOMINATION_ID, score }] })
                .success,
        ).toBe(true);
    });

    it.each([-1, 11, 1.5, '2', null])('should reject invalid score %s', (score) => {
        expect(
            submitSelectionSchema.safeParse({ scores: [{ nominationId: NOMINATION_ID, score }] })
                .success,
        ).toBe(false);
    });

    it.each([
        {},
        { scores: [] },
        { scores: [{ nominationId: 'bad', score: 1 }] },
        { scores: [{ nominationId: NOMINATION_ID }] },
        { scores: [{ nominationId: NOMINATION_ID, score: 1, extra: true }] },
        { scores: [{ nominationId: NOMINATION_ID, score: 1 }], participantId: NOMINATION_ID },
    ])('should reject malformed or incomplete request %j', (input) => {
        expect(submitSelectionSchema.safeParse(input).success).toBe(false);
    });
});
