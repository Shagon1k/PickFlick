import { RATINGS_CSV_HEADER, RATINGS_CSV_MAX_BYTES } from '@pickflick/contracts';

import { escapeCsvCell, parseRatingsCsv } from '../ratings-csv.js';

const MOVIE_ID = '10000000-0000-4000-8000-000000000001';
const parse = (records: string, header = RATINGS_CSV_HEADER) =>
    parseRatingsCsv(Buffer.from(`${header}\r\n${records}`));

describe('Ratings CSV', () => {
    it('should parse UTF-8, BOM, CRLF, escaped quotes, commas and multiline names', () => {
        expect(
            parse(
                `1,${MOVIE_ID},"Café, ""Movie""\nPart two",10\r\n`,
                `\uFEFF${RATINGS_CSV_HEADER}`,
            ),
        ).toEqual({
            entries: [{ row: 2, movieId: MOVIE_ID, rating: 10 }],
            errors: [],
            total: 1,
        });
    });

    it('should report every invalid record without accepting title-based or duplicate mapping', () => {
        const result = parse(
            [
                `1,${MOVIE_ID},Film,8`,
                `1,${MOVIE_ID},Duplicate,8`,
                `2,${MOVIE_ID},Film,8`,
                '1,unknown,Film,7',
                `1,${MOVIE_ID},Film,11`,
                `1,${MOVIE_ID},=HYPERLINK(),7`,
                `1,${MOVIE_ID},Film,=1+1`,
                '1,two-columns',
            ].join('\n'),
        );
        expect(result.total).toBe(8);
        expect(result.entries).toHaveLength(1);
        expect(result.errors.map((error) => error.row)).toEqual([3, 4, 5, 6, 7, 8, 9]);
        expect(result.errors.every((error) => error.message.length > 10)).toBe(true);
    });

    it.each(['=SUM(1)', '+cmd', '-cmd', '@SUM(1)', ' \t=cmd', '\r\n@cmd'])(
        'should neutralize formula-like names %j and allow the safe exported text on import',
        (name) => {
            const escaped = escapeCsvCell(name);
            expect(escaped.startsWith('"\'')).toBe(true);
            expect(parse(`1,${MOVIE_ID},${escaped},8`).errors).toEqual([]);
            expect(parse(`1,${MOVIE_ID},"${name}",8`).errors).toHaveLength(1);
        },
    );

    it.each([
        `1,${MOVIE_ID},"unclosed,8`,
        `1,${MOVIE_ID},"closed"extra,8`,
        `1,${MOVIE_ID},un"quoted,8`,
        `1,${MOVIE_ID},${'x'.repeat(2049)},8`,
        `1,${MOVIE_ID},NUL\0,8`,
        '',
    ])('should reject malformed, empty or excessive cells %j', (record) => {
        expect(parse(record).errors).not.toHaveLength(0);
        expect(parse(record).entries).toEqual([]);
    });

    it('should reject wrong headers, unknown columns, non-UTF-8, oversized bytes and too many rows', () => {
        for (const header of [
            'name,rating',
            `${RATINGS_CSV_HEADER},user_id`,
            '"version,movie_id,name,rating"',
        ])
            expect(parse('', header).errors).not.toHaveLength(0);
        expect(parseRatingsCsv(Buffer.from([0xff])).errors).not.toHaveLength(0);
        expect(parseRatingsCsv(Buffer.alloc(RATINGS_CSV_MAX_BYTES + 1)).errors).not.toHaveLength(0);
        expect(parseRatingsCsv('text').errors).not.toHaveLength(0);
        expect(
            parse(Array.from({ length: 1001 }, () => `1,${MOVIE_ID},Film,8`).join('\n')).errors,
        ).not.toHaveLength(0);
    });

    it('should accept the full 1000-record budget without a final newline', () => {
        const records = Array.from({ length: 1000 }, (_, index) => {
            const suffix = String(index + 1).padStart(12, '0');
            return `1,10000000-0000-4000-8000-${suffix},Film,1`;
        });
        const result = parse(records.join('\n'));
        expect(result.errors).toEqual([]);
        expect(result.entries).toHaveLength(1000);
    });
});
