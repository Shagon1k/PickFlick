import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

import { settingsProjection as clubSettingsProjection } from './club-projections.mjs';
import { handleMovieSearch } from './movie-search.mjs';
import { readJson, sendError, sendJson } from './mock-http.mjs';
import { handlePendingInvitation } from './pending-invites.mjs';

const clubsBySession = new Map();
const removedMembersBySession = new Set();
const avatarVersionsBySession = new Map();
const settingsClubId = '10000000-0000-4000-8000-000000000031';
const secondClubId = '10000000-0000-4000-8000-000000000032';
const avatarPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);

const settingsProjection = (token) =>
    clubSettingsProjection(
        token,
        avatarVersionsBySession.get(token),
        removedMembersBySession.has(token),
    );

function hubClubs(token) {
    if (!token?.includes('hub')) {
        return clubsBySession.get(token) ?? [];
    }
    const first = settingsProjection(token).club;
    const second = {
        ...first,
        id: secondClubId,
        name: 'Second Screening Room',
        description: 'A different Club.',
        membershipRole: 'MEMBER',
    };
    return token.includes('revoked') ? [first] : [first, second];
}

function hubProjection(token, clubId) {
    const club = hubClubs(token).find(({ id }) => id === clubId);
    if (!club) {
        return null;
    }
    if (clubId !== settingsClubId && clubId !== secondClubId) {
        return {
            club,
            access: settingsProjection(token).access,
            permissions: settingsProjection(token).permissions,
            memberCount: 1,
            sessionCount: 0,
            completedSessionCount: 0,
            recentSessions: [],
        };
    }
    const second = clubId === secondClubId;
    const session = {
        id: second
            ? '30000000-0000-4000-8000-000000000032'
            : '30000000-0000-4000-8000-000000000031',
        phase: second ? 'RATING' : 'NOMINATION',
        topic: second ? 'Second Club private screening' : 'Midnight private screening',
        scheduledAt: '2026-10-01T20:00:00.000Z',
        location: second ? 'Room B' : 'Room A',
        updatedAt: '2026-09-29T12:00:00.000Z',
    };
    return {
        club,
        access: settingsProjection(token).access,
        permissions: settingsProjection(token).permissions,
        memberCount: second ? 4 : 2,
        sessionCount: second ? 7 : 1,
        completedSessionCount: second ? 3 : 0,
        activeSession: session,
        recentSessions: [session],
    };
}

function sessionToken(request) {
    return request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/)?.[1];
}

function sendNoContent(response) {
    response.writeHead(204).end();
}

function handleSession(request, response) {
    const token = sessionToken(request);
    if (token === 'session-api-unavailable') {
        sendJson(response, 503, null);
        return;
    }
    const authenticated = token?.startsWith('valid') ?? false;
    sendJson(response, 200, authenticated ? { user: { id: `user-${token}` } } : null);
}

function createClub(request, response, token) {
    readJson(request, (payload) => {
        if ((clubsBySession.get(token) ?? []).length > 0) {
            sendError(response, 409, 'CONFLICT', 'request-club-limit', 'ADMIN_CLUB_LIMIT_REACHED');
            return;
        }
        const description = String(payload.description ?? '').trim();
        const club = {
            id: '10000000-0000-4000-8000-000000000099',
            name: String(payload.name).trim(),
            ...(description ? { description } : {}),
            hasAvatar: false,
            lifecycle: 'ACTIVE',
            membershipRole: 'ADMIN',
            selectionScaleMin: payload.selectionScaleMin,
            selectionScaleMax: payload.selectionScaleMax,
            tier: 'FREE',
        };
        clubsBySession.set(token, [club]);
        sendJson(response, 201, club);
    });
}

function handleClubs(request, response) {
    const token = sessionToken(request);
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-club-auth');
        return;
    }
    if (request.method === 'GET') {
        sendJson(response, 200, hubClubs(token));
    } else if (request.method === 'POST') {
        createClub(request, response, token);
    } else {
        response.writeHead(405).end();
    }
}

function sendAvatar(response) {
    response.writeHead(200, {
        'cache-control': 'private, no-store',
        'content-length': avatarPng.length,
        'content-type': 'image/png',
    });
    response.end(avatarPng);
}

function changeRole(response, token) {
    if (token.includes('settings-admin')) {
        sendNoContent(response);
    } else {
        sendError(response, 403, 'FORBIDDEN', 'request-role-private');
    }
}

function uploadAvatar(request, response, token) {
    const previous = Number(avatarVersionsBySession.get(token)?.split('-')[1] ?? 0);
    avatarVersionsBySession.set(token, `avatar-${previous + 1}`);
    request.resume();
    sendNoContent(response);
}

function removeAvatar(request, response, token) {
    avatarVersionsBySession.delete(token);
    request.resume();
    sendNoContent(response);
}

/** Routes under one Club, keyed by method and the path after `/clubs/<id>`. */
const managedInvites = new Map();
const failedInvitationRefreshes = new Set();
function manageInvitation(request, response, session) {
    readJson(request, () => {
        const id = '60000000-0000-4000-8000-000000000034';
        const created = {
            id,
            token: invitationTokens.valid,
            expiresAt: '2026-10-10T12:00:00.000Z',
        };
        managedInvites.set(session, [{ id, expiresAt: created.expiresAt, state: 'pending' }]);
        sendJson(response, 201, created);
    });
}

const clubRoutes = [
    [
        'POST',
        /^\/members\/[^/]+\/remove$/u,
        (request, response, token) => {
            readJson(request, ({ confirmation }) => {
                if (confirmation !== 'REMOVE') {
                    sendError(
                        response,
                        409,
                        'CONFLICT',
                        'request-member-remove',
                        'CONFIRMATION_MISMATCH',
                    );
                    return;
                }
                removedMembersBySession.add(token);
                sendNoContent(response);
            });
        },
    ],
    ['POST', /^\/invitations$/u, manageInvitation],
    [
        'GET',
        /^\/invitations$/u,
        (_request, response, session) => {
            if (session.includes('refresh-failure') && !failedInvitationRefreshes.has(session)) {
                failedInvitationRefreshes.add(session);
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-invitation-refresh');
                return;
            }
            if (session.includes('restricted-invitations') && !managedInvites.has(session)) {
                managedInvites.set(session, [
                    {
                        id: '60000000-0000-4000-8000-000000000034',
                        expiresAt: '2026-10-10T12:00:00.000Z',
                        state: 'pending',
                    },
                ]);
            }
            sendJson(response, 200, managedInvites.get(session) ?? []);
        },
    ],
    [
        'POST',
        /^\/invitations\/[^/]+\/revoke$/u,
        (_request, response, session) => {
            managedInvites.set(
                session,
                (managedInvites.get(session) ?? []).map((invite) => ({
                    ...invite,
                    state: 'revoked',
                })),
            );
            sendNoContent(response);
        },
    ],
    [
        'GET',
        /^\/hub$/u,
        (_request, response, token, clubId) => {
            const projection = hubProjection(token, clubId);
            if (projection) {
                sendJson(response, 200, projection);
            } else {
                sendError(response, 404, 'NOT_FOUND', 'request-hub-private');
            }
        },
    ],
    [
        'GET',
        /^\/settings$/u,
        (_request, response, token) => sendJson(response, 200, settingsProjection(token)),
    ],
    ['GET', /^\/avatar$/u, (_request, response) => sendAvatar(response)],
    [
        'PATCH',
        /^\/settings$/u,
        (_request, response, token) => sendJson(response, 200, settingsProjection(token)),
    ],
    [
        'PATCH',
        /^\/members\/[^/]+\/role$/u,
        (_request, response, token) => changeRole(response, token),
    ],
    [
        'POST',
        /^\/(?:archive|reactivate|leave|delete)$/u,
        (_request, response) => sendNoContent(response),
    ],
    ['PUT', /^\/avatar$/u, uploadAvatar],
    ['DELETE', /^\/avatar$/u, removeAvatar],
];

function handleClub(request, response, clubId, subpath) {
    const token = sessionToken(request);
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-settings-auth');
        return;
    }
    if (token.includes('settings-outsider')) {
        // The API answers 404 for a Club the visitor cannot see.
        sendError(response, 404, 'NOT_FOUND', 'request-settings-private');
        return;
    }
    const route = clubRoutes.find(
        ([method, path]) => method === request.method && path.test(subpath),
    );
    if (route) {
        route[2](request, response, token, clubId);
    } else {
        response.writeHead(404).end();
    }
}

const contactFailures = {
    'Rate limited message': [429, 'RATE_LIMITED', 'request-1'],
    'Service unavailable message': [503, 'SERVICE_UNAVAILABLE', 'request-2'],
};

function handleContact(request, response) {
    readJson(request, (payload) => {
        const failure = contactFailures[payload.message];
        if (failure) {
            sendError(response, ...failure);
            return;
        }
        const complete = () => response.writeHead(202).end();
        setTimeout(complete, payload.message === 'Slow Contact response' ? 300 : 0);
    });
}

const invitationResponses = new Map();
const invitationTokens = {
    valid: 'v'.repeat(43),
    expired: 'e'.repeat(43),
    revoked: 'r'.repeat(43),
    full: 'f'.repeat(43),
    member: 'm'.repeat(43),
    paused: 'p'.repeat(43),
    invalid: 'i'.repeat(43),
};

function handleInvitation(request, response, pathname) {
    const session = sessionToken(request);
    if (!session?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-invitation-auth');
        return;
    }
    readJson(request, ({ token, decision }) => {
        if (token === 'z'.repeat(43)) {
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-invitation-unavailable');
            return;
        }
        const key = `${session}:${token}`;
        let preview = invitationResponses.get(key);
        if (!preview) {
            const state = Object.entries(invitationTokens).find(
                ([, value]) => value === token,
            )?.[0];
            if (state === 'valid')
                preview = {
                    state: 'valid',
                    clubName: session.includes('long-name') ? 'W'.repeat(100) : 'Midnight Society',
                    memberCount: 2,
                    inviterName: 'Avery Admin',
                    expiresAt: '2026-10-10T12:00:00.000Z',
                };
            else if (state === 'member')
                preview = { state: 'already-member', clubId: settingsClubId };
            else
                preview = {
                    state:
                        { full: 'over-limit', paused: 'unavailable' }[state] ?? state ?? 'invalid',
                };
        }
        if (pathname.endsWith('/respond') && preview.state === 'valid') {
            preview =
                decision === 'accept'
                    ? { state: 'accepted', clubId: settingsClubId }
                    : { state: 'declined' };
            invitationResponses.set(key, preview);
            if (decision === 'accept')
                clubsBySession.set(session, [settingsProjection(session).club]);
        }
        sendJson(response, 200, preview);
    });
}

const api = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (handleMovieSearch(request, response, pathname, sessionToken(request))) return;
    const clubMatch = pathname.match(/^\/clubs\/([0-9a-f-]{36})(\/.*)?$/u);
    if (
        handlePendingInvitation(request, response, pathname, sessionToken(request), (token) =>
            clubsBySession.set(token, [settingsProjection(token).club]),
        )
    ) {
        return;
    }
    if (request.method === 'POST' && pathname.startsWith('/club-invitations/')) {
        handleInvitation(request, response, pathname);
    } else if (request.method === 'GET' && pathname === '/api/auth/get-session') {
        handleSession(request, response);
    } else if (pathname === '/clubs') {
        handleClubs(request, response);
    } else if (clubMatch) {
        handleClub(request, response, clubMatch[1], clubMatch[2] ?? '');
    } else if (request.method === 'POST' && pathname === '/contact') {
        handleContact(request, response);
    } else {
        response.writeHead(404).end();
    }
});

await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(42731, '127.0.0.1', resolve);
});
const apiAddress = api.address();
if (!apiAddress || typeof apiAddress === 'string') {
    throw new Error('The Contact test API did not bind a TCP port.');
}

const web = spawn(process.execPath, ['apps/frontend/.next/standalone/apps/frontend/server.js'], {
    env: {
        ...process.env,
        BACKEND_INTERNAL_URL: `http://127.0.0.1:${apiAddress.port}`,
        HOSTNAME: '127.0.0.1',
        PORT: '41730',
    },
    stdio: 'inherit',
});

const stop = () => {
    web.kill('SIGTERM');
    api.close();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
web.once('exit', (code) => {
    api.close();
    process.exitCode = code ?? 1;
});
