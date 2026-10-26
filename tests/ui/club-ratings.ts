import {
    CLUB_RATINGS_PAGE_SIZE,
    clubRatingsQuerySchema,
    type TClubRatings,
} from '@pickflick/contracts';

import { sendError, sendJson, type TMockRequest, type TMockResponse } from './mock-http.ts';

const failedReads = new Set<string>();

export function handleClubRatings(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
) {
    if (!/^\/clubs\/[0-9a-f-]{36}\/ratings$/u.test(pathname)) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-club-ratings');
        return true;
    }
    if (token.includes('ratings-transient') && !failedReads.has(token)) {
        failedReads.add(token);
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-club-ratings-transient');
        return true;
    }
    if (token.includes('ratings-unavailable')) {
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-club-ratings');
        return true;
    }
    if (token.includes('ratings-denied')) {
        sendError(response, 404, 'NOT_FOUND', 'request-club-ratings');
        return true;
    }
    const query = clubRatingsQuerySchema.parse(
        Object.fromEntries(new URL(request.url!, 'http://127.0.0.1').searchParams),
    );
    const isPro = token.includes('ratings-pro');
    const items: TClubRatings['items'] =
        isPro && !token.includes('empty')
            ? Array.from({ length: 28 }, (_, index) => ({
                  movieId: `10000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
                  title: `Synthetic film ${String(28 - index).padStart(2, '0')}`,
                  year: 2026,
                  genres: ['Drama'],
                  averageRating: 10 - index / 10,
              }))
            : [];
    if (query.sort === 'title') items.sort((a, b) => a.title!.localeCompare(b.title!));
    if (query.sort === 'time') items.reverse();
    const pages = Math.max(1, Math.ceil(items.length / CLUB_RATINGS_PAGE_SIZE));
    const page = Math.min(query.page, pages);
    const body: TClubRatings = {
        analytics: isPro ? 'EXTENDED' : 'BASIC',
        items: items.slice((page - 1) * CLUB_RATINGS_PAGE_SIZE, page * CLUB_RATINGS_PAGE_SIZE),
        total: items.length,
        page,
        pages,
        pageSize: CLUB_RATINGS_PAGE_SIZE,
    };
    sendJson(response, 200, body);
    return true;
}
