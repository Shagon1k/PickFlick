import type { IPendingClubInvitation } from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const responses = new Map<string, string>();
const CLUB_ID = '10000000-0000-4000-8000-000000000031';

export function handlePendingInvitation(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
    accept: (token: string) => void,
): boolean {
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
        const pending: IPendingClubInvitation[] =
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
                : [];
        sendJson(response, 200, pending);
    } else {
        readJson<{ decision: 'accept' | 'decline' }>(request, ({ decision }) => {
            responses.set(token, decision);
            if (decision === 'accept') accept(token);
            sendJson(
                response,
                200,
                decision === 'accept'
                    ? { state: 'accepted', clubId: CLUB_ID }
                    : { state: 'declined' },
            );
        });
    }
    return true;
}
