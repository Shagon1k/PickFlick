import { readJson, sendError, sendJson } from './mock-http.mjs';

const states = new Map();
const sessionId = '30000000-0000-4000-8000-000000000042';
const clubId = '10000000-0000-4000-8000-000000000031';
const movie = {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Past losing nomination',
    year: 2020,
};
function stateFor(token) {
    if (!states.has(token)) states.set(token, { own: null, phase: 'NOMINATION', version: 1 });
    return states.get(token);
}
function projection(token, state) {
    const hidden = token.includes('hidden') && !state.own;
    return {
        acceptedCount: state.departed ? 2 : 3,
        nominatedCount: state.own ? 2 : 1,
        canSubmit: !state.own && state.phase === 'NOMINATION' && !token.includes('readonly'),
        canClose: token.includes('operator') && state.phase === 'NOMINATION',
        hidden,
        ownMovie: state.own,
        nominations: hidden
            ? []
            : [
                  {
                      movie: { ...movie, title: 'Current private film' },
                      author: token.includes('anonymous') ? null : 'Jordan Member',
                  },
                  ...(state.own
                      ? [{ movie: state.own, author: token.includes('anonymous') ? null : 'You' }]
                      : []),
              ],
        suggestions: state.own || token.includes('empty') ? [] : [movie],
    };
}
function handleRoster(response, pathname, token, state) {
    if (!token?.includes('nomination') || pathname !== `/sessions/${sessionId}/roster`)
        return false;
    const version = state.version;
    const departed = state.departed;
    // Commit a departure after the roster snapshot, before the detail response.
    if (token.includes('split-roster') && !departed) {
        state.departed = true;
        state.version++;
        state.sendDetail?.();
    }
    sendJson(response, 200, {
        version: 1,
        progressVersion: version,
        acceptedCount: departed ? 2 : 3,
        canInvite: false,
        canManage: false,
        canLeave: false,
        participants: (departed ? ['Avery', 'You'] : ['Avery', 'Jordan', 'You']).map(
            (name, index) => ({
                id: `30000000-0000-4000-8000-00000000000${index}`,
                membershipId: `40000000-0000-4000-8000-00000000000${index}`,
                displayName: name,
                status: 'ACCEPTED',
                canRemove: false,
                invitation: null,
            }),
        ),
        eligibleMembers: [],
    });
    return true;
}

export function handleNominations(request, response, pathname, token) {
    const state = stateFor(token);
    if (state.recoverAt > Date.now() && pathname === state.failedPath) {
        sendError(response, 503, 'UNAVAILABLE', 'refresh-failure');
        return true;
    }
    if (handleRoster(response, pathname, token, state)) return true;
    if (handleProgress(response, pathname, token)) return true;
    if (
        !/^\/sessions\/[^/]+\/nominations(?:\/close)?$/u.test(pathname) &&
        !(token?.includes('nomination') && pathname === `/sessions/${sessionId}`)
    )
        return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'nomination-auth');
        return true;
    }
    if (pathname === `/sessions/${sessionId}`) {
        const sendDetail = () =>
            sendJson(response, 200, {
                id: sessionId,
                clubId,
                clubName: 'Midnight Society',
                topic: 'Nomination night',
                notes: 'Everyone nominates one film.',
                type: 'FULL_CYCLE',
                phase: state.phase,
                location: 'Room A',
                scheduledAt: '2026-12-01T00:00:00.000Z',
                deadlineAt: null,
                movieId: null,
                version: 5,
                phaseVersion: 1,
                progressVersion: state.version,
                nominations: state.phase === 'NOMINATION' ? projection(token, state) : null,
                canEdit: token.includes('operator'),
                canCancel: token.includes('operator'),
            });
        // Ensure the roster's departure commits between these two read snapshots.
        if (token.includes('split-roster') && !state.departed) state.sendDetail = sendDetail;
        else sendDetail();
    } else if (request.method === 'GET') sendJson(response, 200, projection(token, state));
    else
        readJson(request, (input) => {
            if (token.includes('failure')) {
                sendError(response, 503, 'UNAVAILABLE', 'nomination-failure');
                return;
            }
            if (pathname.endsWith('/close')) {
                if (input.phaseVersion !== 1) {
                    sendError(response, 409, 'NOMINATION_CHANGED', 'nomination-version');
                    return;
                }
                state.phase = 'SELECTION';
            } else state.own = { ...movie, id: input.movieId };
            state.version++;
            if (token.includes('refresh-')) {
                // Longer than one progress poll, so the viewer's next refresh hits the failure.
                state.recoverAt = Date.now() + 5500;
                state.failedPath = token.includes('refresh-roster')
                    ? `/sessions/${sessionId}/roster`
                    : `/sessions/${sessionId}`;
            }
            sendJson(response, 201, null);
        });
    return true;
}

function handleProgress(response, pathname, token) {
    if (!token?.includes('nomination') || !pathname.startsWith(`/sessions/${sessionId}/progress`))
        return false;
    const state = stateFor(token);
    sendJson(response, 200, { version: state.version });
    return true;
}
