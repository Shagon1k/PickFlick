import {
    movieImageUrlSchema,
    movieMetadataSchema,
    movieSearchSchema,
    movieTrailerUrlSchema,
    tmdbIdSchema,
} from '../movie.schema.js';

describe('movieSearchSchema', () => {
    it('should trim the query and provide the first page', () => {
        expect(movieSearchSchema.parse({ query: ' movie ' })).toEqual({
            query: 'movie',
            page: 1,
            locale: 'en-US',
        });
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

describe('movie media URLs', () => {
    it.each([
        'https://image.tmdb.org/t/p/original/a.jpg',
        'https://avatars.mds.yandex.net/get-kinopoisk-image/1946459/abc-def/orig',
        'https://image.openmoviedb.com/kinopoisk-images/1946459/abc-def/orig',
        'https://image.openmoviedb.com/posters/a.webp',
        'https://artworks.thetvdb.com/banners/movies/10/a.jpg',
    ])('should accept a trusted CDN URL %s', (value) => {
        expect(movieImageUrlSchema.safeParse(value).success).toBe(true);
    });
    it.each([
        '//image.tmdb.org/a.jpg',
        'http://image.tmdb.org/a.jpg',
        'https://image.tmdb.org.evil.invalid/a.jpg',
        'https://user@image.tmdb.org/a.jpg',
        'https://image.tmdb.org:8443/a.jpg',
        'https://image.tmdb.org/a.jpg?redirect=evil',
        'https://image.tmdb.org/%2e%2e/a.jpg',
        'https://image.tmdb.org/a.svg',
    ])('should reject unsafe image URLs %s', (value) => {
        expect(movieImageUrlSchema.safeParse(value).success).toBe(false);
    });
    it('should accept the documented YouTube embed URL', () => {
        expect(
            movieTrailerUrlSchema.safeParse('https://www.youtube.com/embed/ZsJz2TJAPjw').success,
        ).toBe(true);
    });
    it.each([
        'javascript:alert(1)',
        'https://www.youtube.com.evil.invalid/watch?v=abc123456',
        'https://www.youtube.com/watch?v=abc123456&redirect=evil',
        'https://user@youtu.be/abc123456',
    ])('should reject unsafe trailer URLs %s', (value) => {
        expect(movieTrailerUrlSchema.safeParse(value).success).toBe(false);
    });
});
describe('movieMetadataSchema', () => {
    it('should preserve unknown scalar fields as null and reject fabricated rating scales', () => {
        const unknown = {
            title: null,
            originalTitle: null,
            overview: null,
            releaseDate: null,
            releaseYear: null,
            adult: null,
            originalLanguage: null,
            posterUrl: null,
            backdropUrl: null,
            ratings: [],
            runtime: null,
            genres: null,
            directors: null,
            writers: null,
            budget: null,
            revenue: null,
            cast: null,
            trailers: null,
        };
        expect(movieMetadataSchema.parse(unknown)).toEqual(unknown);
        expect(
            movieMetadataSchema.safeParse({
                ...unknown,
                ratings: [{ source: 'imdb', value: 11, scale: 10, voteCount: null }],
            }).success,
        ).toBe(false);
    });
});
