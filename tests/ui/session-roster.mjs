import { readJson, sendError, sendJson } from './mock-http.mjs';

const sessionId = '30000000-0000-4000-8000-000000000041';
const clubId = '10000000-0000-4000-8000-000000000031';
const participantId = '40000000-0000-4000-8000-000000000041';
const membershipId = '50000000-0000-4000-8000-000000000041';
const inviteId = '60000000-0000-4000-8000-000000000041';
const states = new Map();
const expiresAt = '2026-12-01T12:00:00.000Z';
const session = {
    id: sessionId,
    clubId,
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
};
function stateFor(token) {
    if (!states.has(token))
        states.set(token, {
            status: token?.includes('accepted') ? 'ACCEPTED' : 'INVITED',
            invite: 'pending',
        });
    return states.get(token);
}
function rosterProjection(token, state) {
    const manager = !token.includes('member');
    return {
        version: 1,
        progressVersion: 1,
        acceptedCount: state.status === 'ACCEPTED' ? 1 : 0,
        canInvite: manager && token.includes('session-roster'),
        canManage: manager,
        canLeave: state.status === 'ACCEPTED',
        participants: token.includes('session-roster')
            ? [
                  {
                      id: participantId,
                      membershipId,
                      displayName: 'Jordan Member',
                      status: state.status,
                      canRemove: manager && ['ACCEPTED', 'INVITED'].includes(state.status),
                      invitation: manager ? { id: inviteId, expiresAt, state: state.invite } : null,
                  },
              ]
            : [],
        eligibleMembers: manager ? [{ id: membershipId, displayName: 'Jordan Member' }] : [],
    };
}
function previewProjection(token, state) {
    if (token.includes('outsider') || token.includes('invalid')) return { state: 'unavailable' };
    if (state.status === 'ACCEPTED') return { state: 'accepted', sessionId, clubId };
    return {
        state: 'valid',
        clubName: session.clubName,
        topic: session.topic,
        scheduledAt: session.scheduledAt,
        location: session.location,
        inviterName: 'Avery Admin',
        expiresAt,
    };
}
function mutate(request, response, pathname, token, state) {
    if (pathname.endsWith('/revoke')) {
        state.invite = 'revoked';
        response.writeHead(204);
        response.end();
        return;
    }
    readJson(request, (input) => {
        if (token.includes('failure')) {
            sendError(response, 503, 'UNAVAILABLE', 'roster-failure');
            return;
        }
        if (pathname.endsWith('/respond')) {
            if (token.includes('outsider')) {
                sendJson(response, 200, { state: 'unavailable' });
                return;
            }
            state.status = input.decision === 'accept' ? 'ACCEPTED' : 'DECLINED';
            sendJson(
                response,
                200,
                input.decision === 'accept'
                    ? { state: 'accepted', sessionId, clubId }
                    : { state: 'declined' },
            );
            return;
        }
        if (pathname.endsWith('/invitations')) {
            state.status = 'INVITED';
            state.invite = 'pending';
            sendJson(response, 201, { id: inviteId, token: 's'.repeat(43), expiresAt });
            return;
        }
        if (pathname.endsWith('/leave')) state.status = 'LEFT';
        if (pathname.endsWith('/remove')) state.status = 'REMOVED';
        response.writeHead(204);
        response.end();
    });
}
export function handleSessionRoster(request, response, pathname, token) {
    const invitation = pathname.startsWith('/session-invitations/');
    const roster = /^\/sessions\/[^/]+\/(?:roster|invitations|participants|leave)/u.test(pathname);
    const detail = pathname === `/sessions/${sessionId}` && token?.includes('session-roster');
    if (!invitation && !roster && !detail) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'roster-auth');
        return true;
    }
    const state = stateFor(token);
    if (detail) {
        const manager = !token.includes('member');
        sendJson(response, 200, { ...session, canEdit: manager, canCancel: manager });
    } else if (pathname === '/session-invitations/pending') {
        const pending =
            token.includes('session-roster-pending') &&
            state.status === 'INVITED' &&
            state.invite === 'pending';
        sendJson(
            response,
            200,
            pending
                ? [
                      {
                          id: inviteId,
                          clubName: session.clubName,
                          topic: session.topic,
                          inviterName: 'Avery Admin',
                          expiresAt,
                      },
                  ]
                : [],
        );
    } else if (pathname.endsWith('/roster')) {
        sendJson(response, 200, rosterProjection(token, state));
    } else if (pathname.endsWith('/preview')) {
        sendJson(response, 200, previewProjection(token, state));
    } else {
        mutate(request, response, pathname, token, state);
    }
    return true;
}
