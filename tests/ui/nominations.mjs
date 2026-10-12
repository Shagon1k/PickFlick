import { readJson, sendError, sendJson } from './mock-http.mjs';

const states = new Map();
const sessionId = '30000000-0000-4000-8000-000000000042';
const clubId = '10000000-0000-4000-8000-000000000031';
const movie = {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Past losing nomination',
    year: 2020,
};
function projection(token, state) {
    const hidden = token.includes('hidden') && !state.own;
    return {
        acceptedCount: 3,
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
export function handleNominations(request, response, pathname, token) {
    if (token?.includes('nomination') && pathname === `/sessions/${sessionId}/roster`) {
        sendJson(response, 200, {
            version: 1,
            acceptedCount: 3,
            canInvite: false,
            canManage: false,
            canLeave: false,
            participants: ['Avery', 'Jordan', 'You'].map((name, index) => ({
                id: `30000000-0000-4000-8000-00000000000${index}`,
                membershipId: `40000000-0000-4000-8000-00000000000${index}`,
                displayName: name,
                status: 'ACCEPTED',
                canRemove: false,
                invitation: null,
            })),
            eligibleMembers: [],
        });
        return true;
    }
    if (
        !/^\/sessions\/[^/]+\/nominations(?:\/close)?$/u.test(pathname) &&
        !(token?.includes('nomination') && pathname === `/sessions/${sessionId}`)
    )
        return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'nomination-auth');
        return true;
    }
    if (!states.has(token)) states.set(token, { own: null, phase: 'NOMINATION' });
    const state = states.get(token);
    if (pathname === `/sessions/${sessionId}`) {
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
            nominations: state.phase === 'NOMINATION' ? projection(token, state) : null,
            canEdit: token.includes('operator'),
            canCancel: token.includes('operator'),
        });
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
            sendJson(response, 201, null);
        });
    return true;
}
