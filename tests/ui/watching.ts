import { type ISessionRoster, openRatingSchema, type TSession } from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const SESSION_ID = '30000000-0000-4000-8000-000000000049';
const opened = new Set<string>();

export function handleWatching(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    if (!token?.startsWith('valid-watching') || !pathname.startsWith(`/sessions/${SESSION_ID}`))
        return false;
    const canManage = !token.includes('member') && !token.includes('readonly');
    const isRating = opened.has(token);
    const version = isRating ? 2 : 1;
    if (pathname.endsWith('/rating/open')) {
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
    } else if (pathname.endsWith('/progress')) {
        sendJson(response, 200, { version });
    } else if (pathname.endsWith('/roster')) {
        const roster: ISessionRoster = {
            progressVersion: version,
            acceptedCount: 1,
            canJoin: false,
            canLeave: true,
            canManage,
            canInvite: canManage,
            eligibleMembers: [],
            participants: [
                {
                    id: '40000000-0000-4000-8000-000000000049',
                    membershipId: '50000000-0000-4000-8000-000000000049',
                    displayName: 'Jordan Member',
                    status: 'ACCEPTED',
                    canRemove: canManage,
                    invitation: null,
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
            canEdit: canManage,
            canCancel: canManage,
            nominations: null,
            selection: null,
            pastSelection: null,
            selectionOutcome: null,
            rating: null,
        };
        sendJson(response, 200, session);
    }
    return true;
}
