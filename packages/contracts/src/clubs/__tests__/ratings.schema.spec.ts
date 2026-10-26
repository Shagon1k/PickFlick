import { clubRatingsQuerySchema } from '../ratings.schema.js';

describe('clubRatingsQuerySchema', () => {
    it('should provide defaults and parse bounded pages', () => {
        expect(clubRatingsQuerySchema.parse({})).toEqual({ sort: 'rating', page: 1 });
        expect(clubRatingsQuerySchema.parse({ sort: 'title', page: '2' })).toEqual({
            sort: 'title',
            page: 2,
        });
    });
    it.each([
        { sort: 'secret' },
        { page: 0 },
        { page: -1 },
        { page: 1.5 },
        { page: 100001 },
        { sort: ['rating', 'title'] },
        { page: ['1', '2'] },
        { userId: 'other' },
    ])('should reject invalid query %j', (query) => {
        expect(clubRatingsQuerySchema.safeParse(query).success).toBe(false);
    });
});
