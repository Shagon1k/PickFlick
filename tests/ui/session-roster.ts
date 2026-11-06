import type {
    IPendingSessionInvitation,
    ISessionRoster,
    TSession,
    TSessionParticipationResult,
} from '@pickflick/contracts';

import {
    readJson,
    rejectMethod,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

type TParticipant = ISessionRoster['participants'][number];
interface IRosterState {
    status: TParticipant['status'];
}

const SESSION_ID = '30000000-0000-4000-8000-000000000041';
const CLUB_ID = '10000000-0000-4000-8000-000000000031';
const PARTICIPANT_ID = '40000000-0000-4000-8000-000000000041';
const MEMBERSHIP_ID = '50000000-0000-4000-8000-000000000041';
const states = new Map<string, IRosterState>();
const session: Omit<TSession, 'canManage'> = {
    id: SESSION_ID,
    clubId: CLUB_ID,
    clubName: 'Midnight Society',
    type: 'FULL_CYCLE',
    phase: 'NOMINATION',
    scheduledAt: '2026-12-01T20:00:00.000Z',
    location: 'Room A',
    topic: 'Private noir night',
    notes: null,
    deadlineAt: null,
    movieId: null,
    version: 1,
    phaseVersion: 1,
    progressVersion: 1,
    nominations: null,
    selection: null,
    selectionOutcome: null,
    selectionScores: null,
    nominationAuthors: null,
    rating: null,
};
function stateFor(token: string): IRosterState {
    const state = states.get(token) ?? {
        status: token.includes('accepted') ? 'ACCEPTED' : 'INVITED',
    };
    states.set(token, state);
    return state;
}
function rosterProjection(token: string, state: IRosterState): ISessionRoster {
    const isManager = !token.includes('member');
    return {
        progressVersion: 1,
        memberCount: 3,
        acceptedCount: state.status === 'ACCEPTED' ? 1 : 0,
        canJoin: state.status === 'INVITED',
        isRemoved: false,
        canManage: isManager,
        canLeave: state.status === 'ACCEPTED',
        participants: token.includes('session-roster')
            ? [
                  {
                      id: PARTICIPANT_ID,
                      membershipId: MEMBERSHIP_ID,
                      displayName: 'Jordan Member',
                      status: state.status,
                      canRemove: isManager && ['ACCEPTED', 'INVITED'].includes(state.status),
                  },
              ]
            : [],
    };
}
function mutate(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string,
    state: IRosterState,
): void {
    readJson<{ decision?: 'accept' | 'decline' }>(request, (input) => {
        if (token.includes('failure')) {
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'roster-failure');
            return;
        }
        if (pathname.endsWith('/participation')) {
            state.status = input.decision === 'accept' ? 'ACCEPTED' : 'DECLINED';
            const result: TSessionParticipationResult =
                input.decision === 'accept'
                    ? { state: 'accepted', sessionId: SESSION_ID, clubId: CLUB_ID }
                    : { state: 'declined' };
            sendJson(response, 200, result);
            return;
        }
        if (pathname.endsWith('/leave')) state.status = 'LEFT';
        if (pathname.endsWith('/remove')) state.status = 'REMOVED';
        response.writeHead(204);
        response.end();
    });
}
export function handleSessionRoster(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    const isPendingRoute = pathname === '/session-invitations/pending';
    const rosterRoute =
        /^\/sessions\/[^/]+\/(roster|participation|leave|participants\/[^/]+\/remove)$/u.exec(
            pathname,
        )?.[1];
    const isDetailRoute =
        pathname === `/sessions/${SESSION_ID}` && token?.includes('session-roster');
    if (!isPendingRoute && !rosterRoute && !isDetailRoute) return false;
    const isRead = !rosterRoute || rosterRoute === 'roster';
    if (rejectMethod(request, response, isRead ? 'GET' : 'POST')) return true;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'roster-auth');
        return true;
    }
    const state = stateFor(token);
    if (isDetailRoute) {
        const isManager = !token.includes('member');
        const projection: TSession = { ...session, canManage: isManager };
        sendJson(response, 200, projection);
    } else if (isPendingRoute) {
        const isPending = token.includes('session-roster-pending') && state.status === 'INVITED';
        const invitations: IPendingSessionInvitation[] = isPending
            ? [
                  {
                      id: SESSION_ID,
                      clubName: session.clubName,
                      topic: session.topic,
                      scheduledAt: '2026-12-01T00:00:00.000Z',
                  },
              ]
            : [];
        sendJson(response, 200, invitations);
    } else if (rosterRoute === 'roster') {
        sendJson(response, 200, rosterProjection(token, state));
    } else {
        mutate(request, response, pathname, token, state);
    }
    return true;
}
