import {
    LIBRARY_PAGE_SIZE,
    libraryQuerySchema,
    type TLibrary,
    type TLibraryStatistics,
} from '@pickflick/contracts';

import { sendError, sendJson, type TMockRequest, type TMockResponse } from './mock-http.ts';
import { getLibraryRatings } from './personal-rating.ts';
import { getLibraryWatchlist } from './watchlist.ts';

export function handleLibrary(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
) {
    if (pathname !== '/library' && pathname !== '/library/statistics') return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-library');
        return true;
    }
    if (token.includes('unavailable')) {
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-library');
        return true;
    }
    if (pathname === '/library/statistics') {
        if (token.includes('statistics-timeout')) {
            setTimeout(() => sendJson(response, 200, buildStatistics(token)), 11_000);
        } else {
            sendJson(response, 200, buildStatistics(token));
        }
        return true;
    }
    const query = libraryQuerySchema.parse(
        Object.fromEntries(new URL(request.url!, 'http://127.0.0.1').searchParams),
    );
    const search = (title: string) => title.toLowerCase().includes(query.q.toLowerCase());
    if (query.tab === 'watchlist') {
        const items = getLibraryWatchlist(token).filter(
            (item) => search(item.title) && (!query.priority || item.priority === query.priority),
        );
        const body: TLibrary = { tab: 'watchlist', ...paginate(items, query.page) };
        sendJson(response, 200, body);
    } else {
        const items = getLibraryRatings(token).filter(
            (item) => search(item.title) && (!query.score || item.score === Number(query.score)),
        );
        if (query.sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title));
        const body: TLibrary = { tab: 'my-ratings', ...paginate(items, query.page) };
        sendJson(response, 200, body);
    }
    return true;
}

function buildStatistics(token: string): TLibraryStatistics {
    const ratings = getLibraryRatings(token);
    const hasRatings = ratings.length > 0;
    const director = token.includes('stats')
        ? 'DirectorWithAVeryLongUnbrokenName'.repeat(4)
        : 'Synthetic Director';
    const actor = token.includes('stats')
        ? 'Actor With A Very Long Name '.repeat(5).trim()
        : 'Synthetic Actor';
    const body: TLibraryStatistics = {
        filmsRated: ratings.length,
        ratedThisYear: ratings.filter(
            (rating) => new Date(rating.updatedAt).getUTCFullYear() === new Date().getUTCFullYear(),
        ).length,
        averageRating: hasRatings
            ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
            : null,
        totalWatchHours: ratings.length * 2,
        watchlistCount: getLibraryWatchlist(token).length,
        favoriteGenre: hasRatings ? 'Comedy' : null,
        topDirector: hasRatings ? director : null,
        topActor: hasRatings ? actor : null,
    };
    return body;
}

function paginate<TItem>(
    items: TItem[],
    requestedPage: number,
): Pick<TLibrary, 'page' | 'pages' | 'total' | 'pageSize'> & { items: TItem[] } {
    const pages = Math.max(1, Math.ceil(items.length / LIBRARY_PAGE_SIZE));
    const page = Math.min(pages, requestedPage);
    return {
        page,
        pages,
        total: items.length,
        pageSize: LIBRARY_PAGE_SIZE,
        items: items.slice((page - 1) * LIBRARY_PAGE_SIZE, page * LIBRARY_PAGE_SIZE),
    };
}
