import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

import { settingsProjection } from './club-projections.mjs';
import { readJson, sendError, sendJson } from './mock-http.mjs';

// Deterministic display fixtures only. Behavioral tests boot the real backend.
const settingsClubId = '10000000-0000-4000-8000-000000000031';
const secondClubId = '10000000-0000-4000-8000-000000000032';
function hubClubs(token) {
    if (!token?.includes('hub')) {
        return [];
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
            ratingSessions: [],
            historySessions: [],
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
        ratingSessions: second ? [session] : [],
        historySessions: [],
    };
}

const invitationStates = {
    e: 'expired',
    r: 'revoked',
    f: 'over-limit',
    p: 'unavailable',
    i: 'invalid',
};
function invitationFixture(request, response, pathname) {
    readJson(request, ({ token, decision }) => {
        if (token[0] === 'z') {
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'visual-error');
            return;
        }
        let state;
        if (pathname.endsWith('/respond'))
            state = { accept: 'accepted', decline: 'declined' }[decision];
        else state = invitationStates[token[0]];
        if (token[0] === 'm') {
            sendJson(response, 200, { state: 'already-member', clubId: settingsClubId });
            return;
        }
        sendJson(
            response,
            200,
            state
                ? { state, ...(state === 'accepted' ? { clubId: settingsClubId } : {}) }
                : {
                      state: 'valid',
                      clubName: 'Midnight Society',
                      memberCount: 2,
                      inviterName: 'Avery Admin',
                      expiresAt: '2026-10-10T12:00:00.000Z',
                  },
        );
    });
}
const pending = [
    {
        id: '60000000-0000-4000-8000-000000000035',
        clubName: 'Saturday Matinee Club',
        memberCount: 2,
        inviterName: 'Avery Admin',
        expiresAt: '2026-10-10T12:00:00.000Z',
    },
];
function handleDisplayRead(request, response, pathname, token) {
    if (pathname === '/api/auth/get-session') {
        sendJson(
            response,
            token === 'session-api-unavailable' ? 503 : 200,
            token?.startsWith('valid') ? { user: { id: `visual-${token}` } } : null,
        );
        return;
    }
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'visual-auth');
        return;
    }
    if (pathname.startsWith('/club-invitations/') && request.method === 'POST') {
        invitationFixture(request, response, pathname);
        return;
    }
    if (request.method !== 'GET') {
        response.writeHead(405).end();
        return;
    }
    sendDisplayFixture(response, pathname, token);
}
const api = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    const token = request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/)?.[1];
    handleDisplayRead(request, response, pathname, token);
});
await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(Number(process.env.BACKEND_PORT), '127.0.0.1', resolve);
});
const web = spawn(process.execPath, ['apps/frontend/.next/standalone/apps/frontend/server.js'], {
    env: {
        ...process.env,
        HOSTNAME: '127.0.0.1',
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

function sendDisplayFixture(response, pathname, token) {
    const fixed = {
        '/clubs': hubClubs(token),
        '/club-invitations/pending': token.includes('pending') ? pending : [],
        '/session-invitations/pending': [],
        [`/clubs/${settingsClubId}/settings`]: settingsProjection(token),
        [`/clubs/${settingsClubId}/invitations`]: [],
    };
    if (Object.hasOwn(fixed, pathname)) sendJson(response, 200, fixed[pathname]);
    else if (pathname.startsWith('/clubs/'))
        sendJson(response, 200, hubProjection(token, pathname.split('/')[2]));
    else response.writeHead(404).end();
}
