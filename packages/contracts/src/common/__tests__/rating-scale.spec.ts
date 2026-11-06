import { formatRatingScore } from '../rating-scale.js';

describe('formatRatingScore', () => {
    it.each([
        [1, '1.0'],
        [7, '7.0'],
        [10, '10'],
    ])('should show %i as %s', (score, text) => {
        expect(formatRatingScore(score)).toBe(text);
    });
});
