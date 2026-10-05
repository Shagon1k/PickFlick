import { readJson, sendError, sendJson } from './mock-http.mjs';

const responses = new Map();
const clubId = '10000000-0000-4000-8000-000000000031';

export function handlePendingInvitation(request, response, pathname, token, accept) {
    const list = pathname === '/club-invitations/pending';
    const respond = /^\/club-invitations\/[^/]+\/respond$/u.test(pathname);
    if (!list && !respond) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'pending-auth');
        return true;
    }
    if (list) {
        if (token.includes('pending-error')) {
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'pending-error');
            return true;
        }
        sendJson(
            response,
            200,
            token.includes('pending') && !responses.has(token)
                ? [
                      {
                          id: '60000000-0000-4000-8000-000000000035',
                          clubName: 'Saturday Matinee Club',
                          memberCount: 2,
                          inviterName: 'Avery Admin',
                          expiresAt: '2026-10-10T12:00:00.000Z',
                      },
                  ]
                : [],
        );
    } else {
        readJson(request, ({ decision }) => {
            responses.set(token, decision);
            if (decision === 'accept') accept(token);
            sendJson(
                response,
                200,
                decision === 'accept' ? { state: 'accepted', clubId } : { state: 'declined' },
            );
        });
    }
    return true;
}
