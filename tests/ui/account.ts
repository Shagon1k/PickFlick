import {
    appearanceSchema,
    type IAccountProfile,
    type TAppearance,
    type TUpdateProfile,
} from '@pickflick/contracts';

import {
    readJson,
    rejectMethod,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const accounts = new Map<string, IAccountProfile>();
const deletedSessions = new Set<string>();

export function isDeletedAccountSession(token?: string) {
    return token !== undefined && deletedSessions.has(token);
}
const failedAccountReads = new Set<string>();
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);
const PATHS = [
    '/account/deletion',
    '/account/deletion/reauth',
    '/account',
    '/account/profile',
    '/account/appearance',
    '/account/avatar',
];

function avatar(request: TMockRequest, response: TMockResponse, account: IAccountProfile) {
    if (rejectMethod(request, response, 'GET', 'PUT', 'DELETE')) return;
    if (request.method === 'GET') {
        if (!account.avatarUrl) sendError(response, 404, 'NOT_FOUND', 'account-avatar');
        else response.writeHead(200, { 'content-type': 'image/png' }).end(PNG);
        return;
    }
    account.avatarUrl = request.method === 'DELETE' ? null : '/api/account/avatar';
    request.resume();
    request.on('end', () => response.writeHead(204).end());
}

function mutate(
    request: TMockRequest,
    response: TMockResponse,
    account: IAccountProfile,
    pathname: string,
) {
    if (rejectMethod(request, response, 'PUT')) return;
    if (pathname === '/account/profile')
        readJson<TUpdateProfile>(request, (input) => {
            account.displayName = input.displayName;
            account.locale = input.locale;
            sendJson(response, 200, account);
        });
    else
        readJson<TAppearance>(request, (input) => {
            account.appearance = input;
            sendJson(response, 200, account);
        });
}

function deletion(request: TMockRequest, response: TMockResponse, pathname: string, token: string) {
    if (pathname === '/account/deletion/reauth') {
        if (!rejectMethod(request, response, 'POST')) {
            request.resume();
            request.on('end', () => response.writeHead(204).end());
        }
    } else if (pathname === '/account/deletion') {
        if (!rejectMethod(request, response, 'POST'))
            readJson<{ confirmation: string }>(request, (input) => {
                if (input.confirmation !== 'DELETE')
                    sendError(response, 400, 'VALIDATION_FAILED', 'deletion-confirmation');
                else if (token.includes('deletion-stale'))
                    sendError(response, 409, 'CONFLICT', 'deletion-reauth', 'REAUTH_REQUIRED');
                else if (token.includes('deletion-failure'))
                    sendError(response, 503, 'SERVICE_UNAVAILABLE', 'deletion-failure');
                else {
                    deletedSessions.add(token);
                    response.writeHead(202).end();
                }
            });
    }
}

export function handleAccount(request: TMockRequest, response: TMockResponse): boolean {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (!PATHS.includes(pathname)) return false;
    const token = request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/u)?.[1];
    if (!token?.startsWith('valid') || isDeletedAccountSession(token)) {
        sendError(response, 401, 'UNAUTHORIZED', 'account-auth');
        return true;
    }
    const shouldFailInitialRead =
        pathname === '/account' &&
        token.includes('account-read-recovery') &&
        !failedAccountReads.has(token);
    if (token.includes('account-unavailable') || shouldFailInitialRead) {
        failedAccountReads.add(token);
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'account-read');
        return true;
    }
    const account =
        accounts.get(token) ??
        ({
            id: `user-${token}`,
            displayName: 'Jane Doe',
            email: 'jane.doe@example.invalid',
            locale: 'en',
            providers: ['google'],
            avatarUrl: null,
            appearance: appearanceSchema.parse({}),
        } satisfies IAccountProfile);
    accounts.set(token, account);
    if (pathname.startsWith('/account/deletion')) deletion(request, response, pathname, token);
    else if (pathname === '/account') {
        if (!rejectMethod(request, response, 'GET')) sendJson(response, 200, account);
    } else if (pathname === '/account/avatar') avatar(request, response, account);
    else if (token.includes('account-save-failure'))
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'account-save');
    else mutate(request, response, account, pathname);
    return true;
}
