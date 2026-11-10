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
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);
const PATHS = ['/account', '/account/profile', '/account/appearance', '/account/avatar'];

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

export function handleAccount(request: TMockRequest, response: TMockResponse): boolean {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (!PATHS.includes(pathname)) return false;
    const token = request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/u)?.[1];
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'account-auth');
        return true;
    }
    if (token.includes('account-unavailable')) {
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
    if (pathname === '/account') {
        if (!rejectMethod(request, response, 'GET')) sendJson(response, 200, account);
    } else if (pathname === '/account/avatar') avatar(request, response, account);
    else if (token.includes('account-save-failure'))
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'account-save');
    else mutate(request, response, account, pathname);
    return true;
}
