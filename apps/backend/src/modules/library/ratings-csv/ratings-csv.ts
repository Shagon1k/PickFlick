import {
    RATINGS_CSV_HEADER,
    RATINGS_CSV_MAX_BYTES,
    RATINGS_CSV_MAX_CELL_LENGTH,
    RATINGS_CSV_MAX_ROWS,
    ratingsCsvRecordSchema,
} from '@pickflick/contracts';

interface ICsvEntry {
    row: number;
    movieId: string;
    rating: number;
}
interface ICsvError {
    row: number;
    message: string;
}

const isFormula = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value);

/** Quote every cell and neutralize spreadsheet formulas, including whitespace-prefixed ones. */
export function escapeCsvCell(value: string): string {
    const safe = isFormula(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
}

const CSV_COLUMN_COUNT = 4;

function readRecords(text: string): string[][] {
    const records: string[][] = [];
    let cells: string[] = [];
    // Sticky matching accepts only the next complete cell, never skipping malformed input.
    const token = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/uy;
    while (token.lastIndex < text.length) {
        const match = token.exec(text);
        if (!match)
            throw new Error(
                'Malformed CSV quoting. Quote cells containing commas or newlines and double embedded quotes.',
            );
        if (cells.length <= CSV_COLUMN_COUNT) cells.push(readCell(match));
        if (match[3] !== ',') {
            records.push(cells);
            cells = [];
        }
        if (records.length > RATINGS_CSV_MAX_ROWS + 1)
            throw new Error(
                'Import at most 1000 ratings per file. Split the file and preview again.',
            );
    }
    if (cells.length) records.push([...cells, '']);
    return records;
}

function readCell(match: RegExpExecArray): string {
    const cell = match[1] === undefined ? match[2]! : match[1].replaceAll('""', '"');
    if (cell.length > RATINGS_CSV_MAX_CELL_LENGTH)
        throw new Error('A cell exceeds 2048 characters. Shorten it and preview again.');
    return cell;
}

function validateRecord(cells: string[], row: number): string | null {
    if (cells.length !== CSV_COLUMN_COUNT)
        return 'Expected four columns: version, movie_id, name, rating.';
    const parsed = ratingsCsvRecordSchema.safeParse(cells);
    if (!parsed.success) return parsed.error.issues.map((issue) => issue.message).join(' ');
    if (isFormula(parsed.data[2]))
        return `Formula-like name in record ${row}. Prefix it with an apostrophe to keep it as text.`;
    return null;
}

export function parseRatingsCsv(input: unknown): {
    entries: ICsvEntry[];
    errors: ICsvError[];
    total: number;
} {
    const fail = (message: string) => ({ entries: [], errors: [{ row: 1, message }], total: 0 });
    if (!Buffer.isBuffer(input)) return fail('Upload a UTF-8 CSV file with content type text/csv.');
    if (input.length > RATINGS_CSV_MAX_BYTES)
        return fail('File exceeds 512 KiB. Split it and preview again.');
    let records: string[][];
    try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(input);
        if (text.includes('\0'))
            return fail('NUL bytes are not allowed. Save the file as UTF-8 CSV.');
        records = readRecords(text);
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return fail(
            error instanceof TypeError ? 'Save the file as valid UTF-8 CSV.' : error.message,
        );
    }
    const header = records.shift();
    if (header?.length !== CSV_COLUMN_COUNT || header.join(',') !== RATINGS_CSV_HEADER)
        return fail(`Expected header: ${RATINGS_CSV_HEADER}. Start with a PickFlick export.`);
    if (records.length > RATINGS_CSV_MAX_ROWS)
        return fail('Import at most 1000 ratings per file. Split the file and preview again.');
    if (!records.length) return fail('No ratings found. Add a rating below the header.');
    const entries: ICsvEntry[] = [];
    const errors: ICsvError[] = [];
    const seen = new Set<string>();
    records.forEach((cells, index) => {
        const row = index + 2;
        const message = validateRecord(cells, row);
        if (message) errors.push({ row, message });
        else {
            const movieId = cells[1]!.toLowerCase();
            if (seen.has(movieId))
                errors.push({ row, message: 'Duplicate Movie ID. Keep one rating per Movie.' });
            else entries.push({ row, movieId, rating: Number(cells[3]) });
            seen.add(movieId);
        }
    });
    return { entries, errors, total: records.length };
}
