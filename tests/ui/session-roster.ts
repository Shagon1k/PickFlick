import type {
    ICreatedInvitation,
    IPendingSessionInvitation,
    ISessionRoster,
    TSession,
    TSessionInvitationPreview,
} from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

type TParticipant = ISessionRoster['participants'][number];
interface IRosterState {
    status: TParticipant['status'];
    invite: NonNullable<TParticipant['invitation']>['state'];
}

const SESSION_ID = '30000000-0000-4000-8000-000000000041';
const CLUB_ID = '10000000-0000-4000-8000-000000000031';
const PARTICIPANT_ID = '40000000-0000-4000-8000-000000000041';
const MEMBERSHIP_ID = '50000000-0000-4000-8000-000000000041';
const INVITE_ID = '60000000-0000-4000-8000-000000000041';
const states = new Map<string, IRosterState>();
const EXPIRES_AT = '2026-12-01T12:00:00.000Z';
const session: Omit<TSession, 'canEdit' | 'canCancel'> = {
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
};
function stateFor(token: string): IRosterState {
    const state = states.get(token) ?? {
        status: token.includes('accepted') ? 'ACCEPTED' : 'INVITED',
        invite: 'pending',
    };
    states.set(token, state);
    return state;
}
function rosterProjection(token: string, state: IRosterState): ISessionRoster {
    const isManager = !token.includes('member');
    return {
        progressVersion: 1,
        acceptedCount: state.status === 'ACCEPTED' ? 1 : 0,
        canJoin: state.status === 'INVITED',
        canInvite: isManager && token.includes('session-roster'),
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
                      invitation: isManager
                          ? { id: INVITE_ID, expiresAt: EXPIRES_AT, state: state.invite }
                          : null,
                  },
              ]
            : [],
        eligibleMembers: isManager ? [{ id: MEMBERSHIP_ID, displayName: 'Jordan Member' }] : [],
    };
}
function previewProjection(token: string, state: IRosterState): TSessionInvitationPreview {
    if (token.includes('outsider') || token.includes('invalid')) return { state: 'unavailable' };
    if (state.status === 'ACCEPTED')
        return { state: 'accepted', sessionId: SESSION_ID, clubId: CLUB_ID };
    return {
        state: 'valid',
        clubName: session.clubName,
        topic: session.topic,
        scheduledAt: session.scheduledAt,
        location: session.location,
        inviterName: 'Avery Admin',
        expiresAt: EXPIRES_AT,
    };
}
function mutate(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string,
    state: IRosterState,
): void {
    if (pathname.endsWith('/revoke')) {
        state.invite = 'revoked';
        response.writeHead(204);
        response.end();
        return;
    }
    readJson<{ decision?: 'accept' | 'decline' }>(request, (input) => {
        if (token.includes('failure')) {
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'roster-failure');
            return;
        }
        if (pathname.endsWith('/respond') || pathname.endsWith('/participation')) {
            if (token.includes('outsider')) {
                sendPreview(response, { state: 'unavailable' });
                return;
            }
            state.status = input.decision === 'accept' ? 'ACCEPTED' : 'DECLINED';
            sendPreview(
                response,
                input.decision === 'accept'
                    ? { state: 'accepted', sessionId: SESSION_ID, clubId: CLUB_ID }
                    : { state: 'declined' },
            );
            return;
        }
        if (pathname.endsWith('/invitations')) {
            state.status = 'INVITED';
            state.invite = 'pending';
            const created: ICreatedInvitation = {
                id: INVITE_ID,
                token: 's'.repeat(43),
                expiresAt: EXPIRES_AT,
            };
            sendJson(response, 201, created);
            return;
        }
        if (pathname.endsWith('/leave')) state.status = 'LEFT';
        if (pathname.endsWith('/remove')) state.status = 'REMOVED';
        response.writeHead(204);
        response.end();
    });
}
function sendPreview(response: TMockResponse, preview: TSessionInvitationPreview): void {
    sendJson(response, 200, preview);
}
export function handleSessionRoster(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    const isInvitationRoute = pathname.startsWith('/session-invitations/');
    const isRosterRoute =
        /^\/sessions\/[^/]+\/(?:roster|invitations|participants|participation|leave)/u.test(
            pathname,
        );
    const isDetailRoute =
        pathname === `/sessions/${SESSION_ID}` && token?.includes('session-roster');
    if (!isInvitationRoute && !isRosterRoute && !isDetailRoute) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'roster-auth');
        return true;
    }
    const state = stateFor(token);
    if (isDetailRoute) {
        const isManager = !token.includes('member');
        const projection: TSession = { ...session, canEdit: isManager, canCancel: isManager };
        sendJson(response, 200, projection);
    } else if (pathname === '/session-invitations/pending') {
        const isPending =
            token.includes('session-roster-pending') &&
            state.status === 'INVITED' &&
            state.invite === 'pending';
        const invitations: IPendingSessionInvitation[] = isPending
            ? [
                  {
                      id: SESSION_ID,
                      clubName: session.clubName,
                      topic: session.topic,
                      expiresAt: null,
                  },
              ]
            : [];
        sendJson(response, 200, invitations);
    } else if (pathname.endsWith('/roster')) {
        sendJson(response, 200, rosterProjection(token, state));
    } else if (pathname.endsWith('/preview')) {
        sendPreview(response, previewProjection(token, state));
    } else {
        mutate(request, response, pathname, token, state);
    }
    return true;
}
