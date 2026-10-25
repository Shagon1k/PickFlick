import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

import type {
    IClubSummary,
    ICreatedInvitation,
    IManagedInvitation,
    TCreateClubRequest,
    TInvitationPreview,
    TRespondInvitation,
} from '@pickflick/contracts';

import { settingsProjection as clubSettingsProjection } from './club-projections.ts';
import { buildHubProjection } from './hub-projections.ts';
import { handleLibrary } from './library.ts';
import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';
import { handleMovieDetails } from './movie-details.ts';
import { handleMovieSearch } from './movie-search.ts';
import { handleNominations } from './nominations.ts';
import { handlePendingInvitation } from './pending-invites.ts';
import { handlePersonalRating } from './personal-rating.ts';
import { handleRating } from './rating.ts';
import { handleSelection } from './selection.ts';
import { handleSessionRoster } from './session-roster.ts';
import { handleSessionWorkflow, sessionHub } from './session-workflows.ts';
import { handleWatching } from './watching.ts';
import { handleWatchlist } from './watchlist.ts';

type TToken = string | undefined;
const clubsBySession = new Map<TToken, IClubSummary[]>();
const removedMembersBySession = new Set<TToken>();
const avatarVersionsBySession = new Map<TToken, string>();
const SETTINGS_CLUB_ID = '10000000-0000-4000-8000-000000000031';
const SECOND_CLUB_ID = '10000000-0000-4000-8000-000000000032';
const avatarPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);

const settingsProjection = (token: TToken) =>
    clubSettingsProjection(
        token,
        avatarVersionsBySession.get(token),
        removedMembersBySession.has(token),
    );

function hubClubs(token: TToken): IClubSummary[] {
    if (
        ['session-workflow', 'settings', 'members', 'invitation'].some((scenario) =>
            token?.includes(scenario),
        )
    )
        return clubsBySession.get(token) ?? [settingsProjection(token).club];
    if (!token?.includes('hub')) {
        return clubsBySession.get(token) ?? [];
    }
    const first = settingsProjection(token).club;
    const second: IClubSummary = {
        ...first,
        id: SECOND_CLUB_ID,
        name: 'Second Screening Room',
        description: 'A different Club.',
        membershipRole: 'MEMBER',
    };
    return token.includes('revoked') ? [first] : [first, second];
}

function hubProjection(token: TToken, clubId: string) {
    if (token?.includes('session-workflow') && clubId === SETTINGS_CLUB_ID)
        return sessionHub(token);
    const club = hubClubs(token).find(({ id }) => id === clubId);
    return club ? buildHubProjection(token, club, settingsProjection(token)) : null;
}

function sessionToken(request: TMockRequest): TToken {
    return request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/)?.[1];
}

function sendNoContent(response: TMockResponse): void {
    response.writeHead(204).end();
}

function handleSession(request: TMockRequest, response: TMockResponse): void {
    const token = sessionToken(request);
    if (token === 'session-api-unavailable') {
        sendJson(response, 503, null);
        return;
    }
    const isAuthenticated = token?.startsWith('valid') ?? false;
    sendJson(response, 200, isAuthenticated ? { user: { id: `user-${token}` } } : null);
}

function createClub(request: TMockRequest, response: TMockResponse, token: string): void {
    readJson<TCreateClubRequest>(request, (payload) => {
        if ((clubsBySession.get(token) ?? []).length > 0) {
            sendError(response, 409, 'CONFLICT', 'request-club-limit', 'ADMIN_CLUB_LIMIT_REACHED');
            return;
        }
        const description = String(payload.description ?? '').trim();
        const club: IClubSummary = {
            id: '10000000-0000-4000-8000-000000000099',
            name: String(payload.name).trim(),
            createdAt: '2026-10-20T00:00:00.000Z',
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

function handleClubs(request: TMockRequest, response: TMockResponse): void {
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

function sendAvatar(response: TMockResponse): void {
    response.writeHead(200, {
        'cache-control': 'private, no-store',
        'content-length': avatarPng.length,
        'content-type': 'image/png',
    });
    response.end(avatarPng);
}

function changeRole(response: TMockResponse, token: string): void {
    if (token.includes('settings-admin')) {
        sendNoContent(response);
    } else {
        sendError(response, 403, 'FORBIDDEN', 'request-role-private');
    }
}

function uploadAvatar(request: TMockRequest, response: TMockResponse, token: string): void {
    const previous = Number(avatarVersionsBySession.get(token)?.split('-')[1] ?? 0);
    avatarVersionsBySession.set(token, `avatar-${previous + 1}`);
    request.resume();
    sendNoContent(response);
}

function removeAvatar(request: TMockRequest, response: TMockResponse, token: string): void {
    avatarVersionsBySession.delete(token);
    request.resume();
    sendNoContent(response);
}

const managedInvites = new Map<string, IManagedInvitation[]>();
const failedInvitationRefreshes = new Set<string>();
const failedHubLoads = new Set<string>();
function manageInvitation(request: TMockRequest, response: TMockResponse, session: string): void {
    readJson(request, () => {
        const id = '60000000-0000-4000-8000-000000000034';
        const created: ICreatedInvitation = {
            id,
            token: invitationTokens.valid,
            expiresAt: '2026-10-10T12:00:00.000Z',
        };
        managedInvites.set(session, [{ id, expiresAt: created.expiresAt, state: 'pending' }]);
        sendJson(response, 201, created);
    });
}

type TClubRoute = [
    method: string,
    path: RegExp,
    handle: (request: TMockRequest, response: TMockResponse, token: string, clubId: string) => void,
];

/** Routes under one Club, keyed by method and the path after `/clubs/<id>`. */
const clubRoutes: TClubRoute[] = [
    [
        'POST',
        /^\/members\/[^/]+\/remove$/u,
        (request, response, token) => {
            readJson<{ confirmation: string }>(request, ({ confirmation }) => {
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
            // Only the refresh after a new link fails; opening the dialog still loads the list.
            if (
                session.includes('refresh-failure') &&
                managedInvites.has(session) &&
                !failedInvitationRefreshes.has(session)
            ) {
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
            if (token?.includes('hub-transient') && !failedHubLoads.has(token)) {
                failedHubLoads.add(token);
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-hub-transient');
                return;
            }
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
        /^\/(?:leave|delete)$/u,
        (_request, response, token) => {
            clubsBySession.set(token, []);
            sendNoContent(response);
        },
    ],
    ['POST', /^\/(?:archive|reactivate)$/u, (_request, response) => sendNoContent(response)],
    ['PUT', /^\/avatar$/u, uploadAvatar],
    ['DELETE', /^\/avatar$/u, removeAvatar],
];

function handleClub(
    request: TMockRequest,
    response: TMockResponse,
    clubId: string,
    subpath: string,
): void {
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

function handleContact(request: TMockRequest, response: TMockResponse): void {
    readJson<{ message: string }>(request, (payload) => {
        if (payload.message === 'Rate limited message') {
            sendError(response, 429, 'RATE_LIMITED', 'request-1');
            return;
        }
        if (payload.message === 'Service unavailable message') {
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-2');
            return;
        }
        const complete = () => response.writeHead(202).end();
        setTimeout(complete, payload.message === 'Slow Contact response' ? 300 : 0);
    });
}

const invitationResponses = new Map<string, TInvitationPreview>();
const invitationTokens = {
    valid: 'v'.repeat(43),
    expired: 'e'.repeat(43),
    revoked: 'r'.repeat(43),
    full: 'f'.repeat(43),
    member: 'm'.repeat(43),
    paused: 'p'.repeat(43),
    invalid: 'i'.repeat(43),
};

function handleInvitation(request: TMockRequest, response: TMockResponse, pathname: string): void {
    const session = sessionToken(request);
    if (!session?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-invitation-auth');
        return;
    }
    readJson<Partial<TRespondInvitation>>(request, ({ token, decision }) => {
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
                preview = { state: 'already-member', clubId: SETTINGS_CLUB_ID };
            else preview = { state: unavailableInvitationState(state) };
        }
        if (pathname.endsWith('/respond') && preview.state === 'valid') {
            preview =
                decision === 'accept'
                    ? { state: 'accepted', clubId: SETTINGS_CLUB_ID }
                    : { state: 'declined' };
            invitationResponses.set(key, preview);
            if (decision === 'accept')
                clubsBySession.set(session, [settingsProjection(session).club]);
        }
        sendJson(response, 200, preview);
    });
}

function unavailableInvitationState(
    state: string | undefined,
): 'invalid' | 'expired' | 'revoked' | 'over-limit' | 'unavailable' {
    if (state === 'full') return 'over-limit';
    if (state === 'paused') return 'unavailable';
    if (state === 'expired' || state === 'revoked') return state;
    return 'invalid';
}

const api = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (
        [
            handleLibrary,
            handleWatchlist,
            handlePersonalRating,
            handleMovieDetails,
            handleMovieSearch,
            handleSelection,
            handleWatching,
            handleRating,
            handleNominations,
            handleSessionRoster,
            handleSessionWorkflow,
        ].some((handler) => handler(request, response, pathname, sessionToken(request)))
    )
        return;
    const clubMatch = /^\/clubs\/([0-9a-f-]{36})(\/.*)?$/u.exec(pathname);
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
        handleClub(request, response, clubMatch[1] ?? '', clubMatch[2] ?? '');
    } else if (request.method === 'POST' && pathname === '/contact') {
        handleContact(request, response);
    } else {
        response.writeHead(404).end();
    }
});

await new Promise<void>((resolve, reject) => {
    api.once('error', reject);
    api.listen(42731, '127.0.0.1', () => resolve());
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
