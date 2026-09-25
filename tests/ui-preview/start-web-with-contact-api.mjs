import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const retryKeys = new Map();
const clubsBySession = new Map();
const avatarVersionsBySession = new Map();
const settingsClubId = '10000000-0000-4000-8000-000000000031';
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
            blockingSessionLimit: 1,
            inactivityGraceDays: 90,
            voteResultVisibility: 'ADMIN_HIDDEN',
            analyticsTier: 'BASIC',
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
                      changed: true,
                      createdAt: '2026-09-18T12:00:00.000Z',
                  },
              ]
            : [],
    };
}

function sessionToken(request) {
    return request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/)?.[1];
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
        sendJson(response, 201, { club });
    });
}

function handleClubs(request, response) {
    const token = sessionToken(request);
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-club-auth');
        return;
    }
    if (request.method === 'GET') {
        sendJson(response, 200, { clubs: clubsBySession.get(token) ?? [] });
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
        sendJson(response, 200, { changed: true, replayed: false });
    } else {
        sendError(response, 403, 'FORBIDDEN', 'request-role-private');
    }
}

function uploadAvatar(request, response, token) {
    const previous = Number(avatarVersionsBySession.get(token)?.split('-')[1] ?? 0);
    avatarVersionsBySession.set(token, `avatar-${previous + 1}`);
    request.resume();
    sendJson(response, 200, { changed: true, hasAvatar: true, replayed: false });
}

function removeAvatar(request, response, token) {
    avatarVersionsBySession.delete(token);
    request.resume();
    sendJson(response, 200, { changed: true, hasAvatar: false, replayed: false });
}

/** Routes under one Club, keyed by method and the path after `/clubs/<id>`. */
const clubRoutes = [
    [
        'GET',
        /^\/settings$/u,
        (_request, response, token) => sendJson(response, 200, settingsProjection(token)),
    ],
    ['GET', /^\/avatar$/u, (_request, response) => sendAvatar(response)],
    [
        'PATCH',
        /^\/settings$/u,
        (_request, response, token) =>
            sendJson(response, 200, {
                changed: true,
                replayed: false,
                settings: settingsProjection(token),
            }),
    ],
    [
        'PATCH',
        /^\/members\/[^/]+\/role$/u,
        (_request, response, token) => changeRole(response, token),
    ],
    [
        'POST',
        /^\/(?:archive|reactivate|leave|delete)$/u,
        (_request, response) => sendJson(response, 200, { changed: true, replayed: false }),
    ],
    ['PUT', /^\/avatar$/u, uploadAvatar],
    ['DELETE', /^\/avatar$/u, removeAvatar],
];

function handleClub(request, response, subpath) {
    const token = sessionToken(request);
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-settings-auth');
        return;
    }
    if (token.includes('settings-outsider')) {
        sendError(response, 403, 'FORBIDDEN', 'request-settings-private');
        return;
    }
    const route = clubRoutes.find(
        ([method, path]) => method === request.method && path.test(subpath),
    );
    if (route) {
        route[2](request, response, token);
    } else {
        response.writeHead(404).end();
    }
}

const contactFailures = {
    'Rate limited message': [429, 'RATE_LIMITED', 'request-1'],
    'Service unavailable message': [503, 'SERVICE_UNAVAILABLE', 'request-2'],
};

/** The first attempt fails; a retry must reuse its submission key or it conflicts. */
function retryFailure(payload) {
    if (payload.message !== 'Retry this exact message') {
        return undefined;
    }
    const previousKey = retryKeys.get(payload.message);
    if (!previousKey) {
        retryKeys.set(payload.message, payload.submissionKey);
        return [503, 'SERVICE_UNAVAILABLE', 'request-3'];
    }
    return previousKey === payload.submissionKey ? undefined : [409, 'CONFLICT', 'request-4'];
}

function handleContact(request, response) {
    readJson(request, (payload) => {
        const failure = contactFailures[payload.message] ?? retryFailure(payload);
        if (failure) {
            sendError(response, ...failure);
            return;
        }
        const complete = () =>
            sendJson(response, 202, {
                id: 'contact-1',
                status: payload.message === 'Duplicate message' ? 'duplicate' : 'accepted',
            });
        setTimeout(complete, payload.message === 'Slow Contact response' ? 300 : 0);
    });
}

const api = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    const clubPrefix = `/clubs/${settingsClubId}`;
    if (request.method === 'GET' && pathname === '/api/auth/get-session') {
        handleSession(request, response);
    } else if (pathname === '/clubs') {
        handleClubs(request, response);
    } else if (pathname.startsWith(clubPrefix)) {
        handleClub(request, response, pathname.slice(clubPrefix.length));
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

const web = spawn(process.execPath, ['apps/web/.next/standalone/apps/web/server.js'], {
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
