import { movieSearchSchema, tmdbIdSchema } from '../movie.schema.js';

describe('movieSearchSchema', () => {
    it('should trim the query and provide the first page', () => {
        expect(movieSearchSchema.parse({ query: ' movie ' })).toEqual({ query: 'movie', page: 1 });
    });

    it.each([
        { query: '' },
        { query: 'movie', page: 501 },
        { query: 'movie', token: 'unexpected' },
    ])('should reject invalid search input %#', (input) => {
        expect(movieSearchSchema.safeParse(input).success).toBe(false);
    });
});

describe('tmdbIdSchema', () => {
    it.each([0, -1, 1.5, 2_147_483_648, '100'])(
        'should reject invalid TMDB identity %s',
        (input) => {
            expect(tmdbIdSchema.safeParse(input).success).toBe(false);
        },
    );
});
