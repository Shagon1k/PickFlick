import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createDatabaseClient } from '@pickflick/database';

import { lockKeys } from '../database/advisory-lock.js';
import { storeAppleCallbackProfile } from './apple-callback-handoff.js';
import { sanitizeAppleCallbackProfile } from './apple-profile.js';
import type { IdentitySessionResolution } from './authorization.types.js';

type NodeAuthHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;
type AccountListHandler = (request: IncomingMessage) => Promise<Response>;

interface AuthHandlerOptions {
    readonly appleSignInEnabled: boolean;
    readonly clientAddressHeader: 'cf-connecting-ip' | 'x-forwarded-for';
    readonly database: ReturnType<typeof createDatabaseClient>;
    readonly listAccounts: AccountListHandler;
    readonly resolveSession: (request: IncomingMessage) => Promise<IdentitySessionResolution>;
}

interface RateLimitRule {
    readonly maximum: number;
    readonly windowMilliseconds: number;
}

const appleCallbackRateLimit: RateLimitRule = { maximum: 10, windowMilliseconds: 60_000 };
const protectedAuthRateLimits: ReadonlyMap<string, RateLimitRule> = new Map([
    ['GET /api/auth/get-session', { maximum: 60, windowMilliseconds: 60_000 }],
    ['GET /api/auth/list-accounts', { maximum: 60, windowMilliseconds: 60_000 }],
    ['POST /api/auth/link-social', { maximum: 10, windowMilliseconds: 60_000 }],
    ['POST /api/auth/unlink-account', { maximum: 10, windowMilliseconds: 60_000 }],
] as const);
const longestAuthRateLimitWindowMilliseconds = Math.max(
    appleCallbackRateLimit.windowMilliseconds,
    ...[...protectedAuthRateLimits.values()].map(({ windowMilliseconds }) => windowMilliseconds),
);

const allowedAuthRequests = new Set([
    'GET /api/auth/callback/google',
    'GET /api/auth/get-session',
    'GET /api/auth/list-accounts',
    'POST /api/auth/callback/google',
    'POST /api/auth/link-social',
    'POST /api/auth/sign-in/social',
    'POST /api/auth/sign-out',
    'POST /api/auth/unlink-account',
]);

const appleCallbackRequests = new Set([
    'GET /api/auth/callback/apple',
    'POST /api/auth/callback/apple',
]);

const protectedAuthRequests = new Set([
    'GET /api/auth/list-accounts',
    'POST /api/auth/link-social',
    'POST /api/auth/unlink-account',
]);

export function isAllowedAuthRequest(
    method: string | undefined,
    requestUrl: string | undefined,
    appleSignInEnabled = false,
): boolean {
    if (!method || !requestUrl) {
        return false;
    }

    const pathname = new URL(requestUrl, 'https://pickflick.invalid').pathname;
    const requestKey = `${method.toUpperCase()} ${pathname}`;
    return (
        allowedAuthRequests.has(requestKey) ||
        (appleSignInEnabled && appleCallbackRequests.has(requestKey))
    );
}

function requestPath(requestUrl: string | undefined): string | undefined {
    return requestUrl ? new URL(requestUrl, 'https://pickflick.invalid').pathname : undefined;
}

async function readFormBody(request: IncomingMessage): Promise<URLSearchParams | undefined> {
    const parsedBody = (request as IncomingMessage & { body?: unknown }).body;
    if (parsedBody && typeof parsedBody === 'object' && !Buffer.isBuffer(parsedBody)) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(parsedBody)) {
            if (typeof value === 'string') {
                params.set(key, value);
            }
        }
        return params;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 100 * 1024) {
            return undefined;
        }
        chunks.push(buffer);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
    response.statusCode = statusCode;
    response.setHeader('cache-control', 'no-store');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
}

function clientAddress(
    request: IncomingMessage,
    headerName: AuthHandlerOptions['clientAddressHeader'],
): string {
    const header = request.headers[headerName];
    const value = Array.isArray(header) ? header[0] : header?.split(',', 1)[0];
    return value?.trim() || request.socket.remoteAddress || 'unknown';
}

async function pruneExpiredRateLimits(
    database: Pick<AuthHandlerOptions['database'], 'authRateLimit'>,
    now: number,
): Promise<void> {
    await database.authRateLimit.deleteMany({
        where: { lastRequest: { lt: BigInt(now - longestAuthRateLimitWindowMilliseconds) } },
    });
}

/**
 * Fixed-window counter in the Better Auth rate-limit table. `lastRequest` stores the window start,
 * so steady traffic below the limit never extends a window the way a sliding timestamp would.
 */
async function consumeRateLimit(
    database: AuthHandlerOptions['database'],
    key: string,
    rule: RateLimitRule,
): Promise<number | undefined> {
    return database.$transaction(async (transaction) => {
        await lockKeys(transaction, `auth-rate-limit:${key}`);
        const now = Date.now();
        const existing = await transaction.authRateLimit.findUnique({ where: { key } });
        if (!existing) {
            await pruneExpiredRateLimits(transaction, now);
            await transaction.authRateLimit.create({ data: { count: 1, key, lastRequest: now } });
            return undefined;
        }

        const windowStartedAt = Number(existing.lastRequest);
        if (now - windowStartedAt >= rule.windowMilliseconds) {
            await transaction.authRateLimit.update({
                data: { count: 1, lastRequest: now },
                where: { key },
            });
            await pruneExpiredRateLimits(transaction, now);
            return undefined;
        }
        if (existing.count >= rule.maximum) {
            return Math.max(
                1,
                Math.ceil((windowStartedAt + rule.windowMilliseconds - now) / 1_000),
            );
        }

        await transaction.authRateLimit.update({
            data: { count: { increment: 1 } },
            where: { key },
        });
        return undefined;
    });
}

function appleCallbackRateLimitKey(request: IncomingMessage, options: AuthHandlerOptions): string {
    return `${clientAddress(request, options.clientAddressHeader)}|POST /callback/apple`;
}

function protectedAuthRateLimitKey(
    request: IncomingMessage,
    requestKey: string,
    options: AuthHandlerOptions,
): string {
    const path = requestKey.slice(requestKey.indexOf('/api/auth') + '/api/auth'.length);
    return `${clientAddress(request, options.clientAddressHeader)}|${path}`;
}

async function authenticatedUserId(
    request: IncomingMessage,
    options: AuthHandlerOptions,
): Promise<string | undefined> {
    const upstream = await options.listAccounts(request);
    if (!upstream.ok) {
        return undefined;
    }
    const body = (await upstream.json()) as unknown;
    const accountIds = Array.isArray(body)
        ? body.flatMap((account) => {
              if (!account || typeof account !== 'object') {
                  return [];
              }
              const id = (account as { id?: unknown }).id;
              return typeof id === 'string' ? [id] : [];
          })
        : [];
    if (accountIds.length === 0) {
        return undefined;
    }

    return (
        await options.database.providerAccount.findFirst({
            where: { id: { in: accountIds } },
            select: { userId: true },
        })
    )?.userId;
}

async function handleSerializedUnlink(
    request: IncomingMessage,
    response: ServerResponse,
    handler: NodeAuthHandler,
    options: AuthHandlerOptions,
): Promise<void> {
    const userId = await authenticatedUserId(request, options);
    if (!userId) {
        await handler(request, response);
        return;
    }

    const lockKey = `identity-unlink:${userId}`;
    await options.database.$transaction(async (transaction) => {
        await lockKeys(transaction, lockKey);
        await handler(request, response);
    });
}

async function handleAppleCallbackPost(
    request: IncomingMessage,
    response: ServerResponse,
    database: ReturnType<typeof createDatabaseClient>,
): Promise<void> {
    const body = await readFormBody(request);
    const code = body?.get('code');
    const state = body?.get('state');
    const error = body?.get('error');
    if (!state || (!code && !error) || state.length > 512 || (code?.length ?? 0) > 4096) {
        writeJson(response, 400, { statusCode: 400, message: 'Invalid Apple callback.' });
        return;
    }

    const callback = new URL('/api/auth/callback/apple', 'https://pickflick.invalid');
    if (code) {
        callback.searchParams.set('code', code);
        const profile = sanitizeAppleCallbackProfile(body?.get('user'));
        if (profile) {
            await storeAppleCallbackProfile(database, state, code, profile);
        }
    } else if (error) {
        callback.searchParams.set('error', error);
    }
    callback.searchParams.set('state', state);

    response.statusCode = 303;
    response.setHeader('cache-control', 'no-store');
    response.setHeader('location', `${callback.pathname}${callback.search}`);
    response.end();
}

async function writeFilteredAccounts(response: ServerResponse, upstream: Response): Promise<void> {
    if (!upstream.ok) {
        response.statusCode = upstream.status;
        upstream.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(Buffer.from(await upstream.arrayBuffer()));
        return;
    }

    const body = (await upstream.json()) as unknown;
    const accounts = Array.isArray(body)
        ? body.flatMap((account) => {
              if (!account || typeof account !== 'object') {
                  return [];
              }
              const { id, providerId } = account as { id?: unknown; providerId?: unknown };
              return typeof id === 'string' && typeof providerId === 'string'
                  ? [{ id, provider: providerId }]
                  : [];
          })
        : [];
    writeJson(response, upstream.status, accounts);
}

/** Writes 429 and returns true when the key has used its window. */
async function rejectRateLimited(
    response: ServerResponse,
    database: AuthHandlerOptions['database'],
    key: string,
    rule: RateLimitRule,
): Promise<boolean> {
    const retryAfter = await consumeRateLimit(database, key, rule);
    if (!retryAfter) {
        return false;
    }
    response.setHeader('retry-after', String(retryAfter));
    writeJson(response, 429, { statusCode: 429, message: 'Too many requests.' });
    return true;
}

/**
 * Resolves the session before Better Auth sees the request. get-session only surfaces an outage;
 * protected account routes also reject a missing or invalid session.
 */
async function rejectUnresolvedSession(
    request: IncomingMessage,
    response: ServerResponse,
    requestKey: string,
    options: AuthHandlerOptions,
): Promise<boolean> {
    const sessionProbe = requestKey === 'GET /api/auth/get-session';
    if (!sessionProbe && !protectedAuthRequests.has(requestKey)) {
        return false;
    }
    const resolution = await options.resolveSession(request);
    if (resolution.authorized) {
        return false;
    }
    if (resolution.reason === 'service_unavailable') {
        writeJson(
            response,
            503,
            sessionProbe ? null : { statusCode: 503, message: 'Unauthorized' },
        );
        return true;
    }
    if (sessionProbe) {
        return false;
    }
    writeJson(response, 401, { statusCode: 401, message: 'Unauthorized' });
    return true;
}

export function restrictAuthHandler(
    handler: NodeAuthHandler,
    options: AuthHandlerOptions,
): NodeAuthHandler {
    const routes: ReadonlyMap<string, NodeAuthHandler> = new Map([
        [
            'POST /api/auth/callback/apple',
            async (request, response) => {
                const key = appleCallbackRateLimitKey(request, options);
                if (
                    !(await rejectRateLimited(
                        response,
                        options.database,
                        key,
                        appleCallbackRateLimit,
                    ))
                ) {
                    await handleAppleCallbackPost(request, response, options.database);
                }
            },
        ],
        [
            'GET /api/auth/list-accounts',
            async (request, response) =>
                writeFilteredAccounts(response, await options.listAccounts(request)),
        ],
        [
            'POST /api/auth/unlink-account',
            async (request, response) =>
                handleSerializedUnlink(request, response, handler, options),
        ],
    ]);

    return async (request, response) => {
        if (!isAllowedAuthRequest(request.method, request.url, options.appleSignInEnabled)) {
            writeJson(response, 404, { statusCode: 404, message: 'Not Found' });
            return;
        }

        const requestKey = `${request.method?.toUpperCase()} ${requestPath(request.url)}`;
        const protectedRule = protectedAuthRateLimits.get(requestKey);
        if (
            protectedRule &&
            (await rejectRateLimited(
                response,
                options.database,
                protectedAuthRateLimitKey(request, requestKey, options),
                protectedRule,
            ))
        ) {
            return;
        }
        if (await rejectUnresolvedSession(request, response, requestKey, options)) {
            return;
        }

        await (routes.get(requestKey) ?? handler)(request, response);
    };
}
