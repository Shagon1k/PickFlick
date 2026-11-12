import {
    RATINGS_CSV_HEADER,
    type TRatingsCsvExport,
    type TRatingsCsvResult,
} from '@pickflick/contracts';

import {
    escapeCsvCell,
    parseRatingsCsv,
} from '../../apps/backend/src/modules/library/ratings-csv/ratings-csv.ts';
import {
    rejectMethod,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const MOVIE_ID = '10000000-0000-4000-8000-000000000001';
const scores = new Map<string, number>();
const PATHS = [
    '/library/ratings-csv',
    '/library/ratings-csv/preview',
    '/library/ratings-csv/import',
];

export function handleRatingsCsv(request: TMockRequest, response: TMockResponse): boolean {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (!PATHS.includes(pathname)) return false;
    const token = request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/u)?.[1];
    if (!token?.startsWith('valid') || token.includes('csv-expired')) {
        sendError(response, 401, 'UNAUTHORIZED', 'csv-auth');
        return true;
    }
    if (token.includes('csv-failure')) {
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'csv-unavailable');
        return true;
    }
    if (pathname === '/library/ratings-csv') {
        if (rejectMethod(request, response, 'GET')) return true;
        const score = scores.get(token);
        const line = score ? `1,${MOVIE_ID},${escapeCsvCell('Film, "One"')},${score}\r\n` : '';
        const result: TRatingsCsvExport = {
            csv: `${RATINGS_CSV_HEADER}\r\n${line}`,
            count: score ? 1 : 0,
        };
        sendJson(response, 200, result);
        return true;
    }
    if (rejectMethod(request, response, 'POST')) return true;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
        const parsed = parseRatingsCsv(Buffer.concat(chunks));
        const result: TRatingsCsvResult = {
            total: parsed.total,
            rows: [],
            errors: parsed.errors,
            imported: false,
        };
        for (const entry of parsed.entries) {
            if (entry.movieId !== MOVIE_ID)
                result.errors.push({
                    row: entry.row,
                    message:
                        'Movie ID is not in this catalog. Choose a known Movie ID; titles are never matched automatically.',
                });
            else {
                const currentRating = scores.get(token) ?? null;
                result.rows.push({
                    ...entry,
                    name: 'Film, "One"',
                    currentRating,
                    action: getAction(currentRating, entry.rating),
                });
            }
        }
        if (pathname.endsWith('/import') && !result.errors.length) {
            for (const row of result.rows) scores.set(token, row.rating);
            result.imported = true;
        }
        sendJson(response, 200, result);
    });
    return true;
}

function getAction(current: number | null, rating: number) {
    if (current === null) return 'create';
    return current === rating ? 'unchanged' : 'update';
}
