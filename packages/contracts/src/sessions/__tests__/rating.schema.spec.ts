import { closeRatingSchema, submitRatingSchema } from '../rating.schema.js';

describe('submitRatingSchema', () => {
    it('should accept the inclusive fixed scale and normalize optional comments', () => {
        expect(submitRatingSchema.parse({ score: 1 })).toEqual({ score: 1 });
        expect(submitRatingSchema.parse({ score: 10, comment: '  First\r\nSecond  ' })).toEqual({
            score: 10,
            comment: 'First\nSecond',
        });
        expect(submitRatingSchema.parse({ score: 8, comment: '' })).toEqual({
            score: 8,
            comment: undefined,
        });
    });
    it.each([0, 11, 1.5, '8', null])('should reject invalid score %s', (score) => {
        expect(submitRatingSchema.safeParse({ score }).success).toBe(false);
    });
    it('should reject oversized or unsafe text and extra fields', () => {
        expect(submitRatingSchema.safeParse({ score: 8, comment: 'a'.repeat(2001) }).success).toBe(
            false,
        );
        expect(submitRatingSchema.safeParse({ score: 8, comment: '\u0000' }).success).toBe(false);
        expect(
            submitRatingSchema.safeParse({ score: 8, participantId: 'someone-else' }).success,
        ).toBe(false);
    });
});

describe('closeRatingSchema', () => {
    it('should require a positive version and exact confirmation', () => {
        expect(
            closeRatingSchema.safeParse({ phaseVersion: 1, confirmation: 'CLOSE' }).success,
        ).toBe(true);
        expect(
            closeRatingSchema.safeParse({ phaseVersion: 0, confirmation: 'CLOSE' }).success,
        ).toBe(false);
        expect(
            closeRatingSchema.safeParse({ phaseVersion: 1, confirmation: 'close' }).success,
        ).toBe(false);
    });
});
