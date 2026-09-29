import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const clubsBySession = new Map();
const avatarVersionsBySession = new Map();
const settingsClubId = '10000000-0000-4000-8000-000000000031';
const secondClubId = '10000000-0000-4000-8000-000000000032';
const avatarPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);

function settingsProjection(token) {
    const role =
        ['member', 'moderator'].find((name) => token?.includes(name))?.toUpperCase() ?? 'ADMIN';
    const lifecycle = token?.includes('archived') ? 'ARCHIVED' : 'ACTIVE';
    const admin = role === 'ADMIN';
    const active = lifecycle === 'ACTIVE';
    const avatarVersion = avatarVersionsBySession.get(token);
    return {
        club: {
            id: settingsClubId,
            name: 'Midnight Society',
            description: 'Noir, classics, and arguments.',
            hasAvatar: Boolean(avatarVersion),
            ...(avatarVersion ? { avatarVersion } : {}),
            lifecycle,
            membershipRole: role,
            selectionScaleMin: 0,
            selectionScaleMax: 7,
            tier: 'FREE',
        },
        permissions: {
            viewClub: true,
            participate: active,
            leaveClub: !admin,
            manageSessions: active && role !== 'MEMBER',
            manageMembers: active && admin,
            manageRoles: active && admin,
            manageSettings: active && admin,
            manageLifecycle: admin,
            viewAudit: admin,
        },
        entitlements: {
            tier: 'FREE',
            adminClubLimit: 1,
            memberLimit: 8,
            voteResultVisibility: 'ADMIN_HIDDEN',
        },
        visibility: {
            showNominationAuthors: true,
            showNominationsBeforeSubmit: true,
            showVoteResults: false,
            showRatingResults: true,
            useMonochromeMedia: true,
        },
        members: [
            {
                id: '20000000-0000-4000-8000-000000000031',
                displayName: 'Avery Admin',
                role: 'ADMIN',
                joinedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                id: '20000000-0000-4000-8000-000000000032',
                displayName: 'Morgan Member',
                role: 'MEMBER',
                joinedAt: '2026-02-01T00:00:00.000Z',
            },
        ],
        auditEvents: admin
            ? [
                  {
                      id: '50000000-0000-4000-8000-000000000031',
                      action: 'CLUB_SETTINGS_UPDATED',
                      createdAt: '2026-09-18T12:00:00.000Z',
                  },
              ]
            : [],
    };
}

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

function sendJson(response, status, body) {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
}

function sendError(response, status, code, requestId, reason) {
    sendJson(response, status, {
        error: { code, message: code, requestId, ...(reason ? { reason } : {}) },
    });
}

function readJson(request, onBody) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => onBody(JSON.parse(body)));
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
const clubRoutes = [
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

const api = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    const clubMatch = pathname.match(/^\/clubs\/([0-9a-f-]{36})(\/.*)?$/u);
    if (request.method === 'GET' && pathname === '/api/auth/get-session') {
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
