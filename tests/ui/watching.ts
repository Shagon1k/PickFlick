import { type ISessionRoster, openRatingSchema, type TSession } from '@pickflick/contracts';

import {
    matchRoute,
    readJson,
    rejectMethod,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const SESSION_ID = '30000000-0000-4000-8000-000000000049';
const ROUTES = { '': 'GET', '/progress': 'GET', '/roster': 'GET', '/rating/open': 'POST' } as const;
const opened = new Set<string>();

export function handleWatching(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    const route = matchRoute(pathname, `/sessions/${SESSION_ID}`, ROUTES);
    if (!token?.startsWith('valid-watching') || route === undefined) return false;
    if (rejectMethod(request, response, ROUTES[route])) return true;
    const canManage = !token.includes('member') && !token.includes('readonly');
    const isRating = opened.has(token);
    const version = isRating ? 2 : 1;
    if (route === '/rating/open') {
        readJson(request, (body) => {
            if (!canManage) sendError(response, 403, 'FORBIDDEN', 'watching-role');
            else if (!openRatingSchema.safeParse(body).success)
                sendError(response, 400, 'VALIDATION_FAILED', 'watching-input');
            else if (token.includes('failure'))
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'watching-unavailable');
            else if (token.includes('stale'))
                sendError(response, 409, 'CONFLICT', 'watching-changed', 'WATCHING_CHANGED');
            else {
                opened.add(token);
                sendJson(response, 201, null);
            }
        });
    } else if (route === '/progress') {
        sendJson(response, 200, { version });
    } else if (route === '/roster') {
        const roster: ISessionRoster = {
            progressVersion: version,
            memberCount: 3,
            acceptedCount: 1,
            canJoin: false,
            isRemoved: false,
            canLeave: true,
            canManage,
            participants: [
                {
                    id: '40000000-0000-4000-8000-000000000049',
                    membershipId: '50000000-0000-4000-8000-000000000049',
                    displayName: 'Jordan Member',
                    status: 'ACCEPTED',
                    canRemove: canManage,
                },
            ],
        };
        sendJson(response, 200, roster);
    } else {
        const session: TSession = {
            id: SESSION_ID,
            clubId: '10000000-0000-4000-8000-000000000031',
            clubName: 'Midnight Society',
            type: 'PRE_SELECTED',
            phase: isRating ? 'RATING' : 'WATCHING',
            movieId: '10000000-0000-4000-8000-000000000037',
            scheduledAt: '2026-12-01T20:00:00.000Z',
            location: 'Room A',
            topic: 'Noir night',
            notes: 'Bring snacks.',
            deadlineAt: null,
            version,
            phaseVersion: version,
            progressVersion: version,
            canManage,
            nominations: null,
            selection: null,
            selectionOutcome: null,
            selectionScores: null,
            nominationAuthors: null,
            rating: null,
        };
        sendJson(response, 200, session);
    }
    return true;
}
