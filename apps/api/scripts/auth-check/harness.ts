import { createServer } from 'node:http';

import type { BetterAuthPlugin } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { testUtils } from 'better-auth/plugins';

import { restrictAuthHandler } from '../../src/identity/auth-http.js';
import { IdentityAuthorizationService } from '../../src/identity/authorization.service.js';
import { createIdentityAuth } from '../../src/identity/identity.service.js';
import { database, environment, logger, nextSyntheticClientAddress } from './context.js';
import { deterministicProviders } from './providers.js';

// Better Auth types its test plugin more loosely than BetterAuthPlugin under exactOptionalPropertyTypes.
const testHelpersPlugin = (): BetterAuthPlugin => testUtils() as BetterAuthPlugin;

export const auth = createIdentityAuth(environment, database, logger, [testHelpersPlugin()]);
export const deterministicAuth = createIdentityAuth(environment, database, logger, [
    deterministicProviders(),
    testHelpersPlugin(),
]);
export const deterministicAuthorization = new IdentityAuthorizationService(
    database,
    logger,
    (headers) =>
        deterministicAuth.api.getSession({
            headers: fromNodeHeaders(headers),
            query: { disableRefresh: true },
        }),
);
export const deterministicHttpServer = createServer(
    restrictAuthHandler(toNodeHandler(deterministicAuth), {
        appleSignInEnabled: true,
        clientAddressHeader: 'x-forwarded-for',
        database,
        listAccounts: (request) =>
            deterministicAuth.api.listUserAccounts({
                asResponse: true,
                headers: fromNodeHeaders(request.headers),
            }),
        resolveSession: (request) => deterministicAuthorization.resolveSession(request.headers),
    }),
);
await new Promise<void>((resolve, reject) => {
    deterministicHttpServer.once('error', reject);
    deterministicHttpServer.listen(0, '127.0.0.1', resolve);
});
export const deterministicHttpAddress = deterministicHttpServer.address();
if (!deterministicHttpAddress || typeof deterministicHttpAddress === 'string') {
    throw new Error('The deterministic authentication HTTP server did not expose a local port.');
}
export const deterministicHttpBaseUrl = `http://127.0.0.1:${deterministicHttpAddress.port}`;
export const existingRateLimitIds = new Set(
    (await database.authRateLimit.findMany({ select: { id: true } })).map(({ id }) => id),
);
export const userIds = new Set<string>();
export const oauthStateIdentifiers = new Set<string>();

export async function startGoogleSignIn(
    identityAuth = auth,
    options: {
        additionalBody?: Readonly<Record<string, unknown>>;
        forwardedHeaders?: Readonly<Record<string, string>>;
        returnTo?: string;
    } = {},
): Promise<{ cookie: string; state: string; url: URL }> {
    const response = await identityAuth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/sign-in/social`, {
            body: JSON.stringify({
                callbackURL: options.returnTo ?? '/app',
                disableRedirect: true,
                provider: 'google',
                ...options.additionalBody,
            }),
            headers: {
                'content-type': 'application/json',
                origin: environment.auth.baseUrl,
                'x-forwarded-for': nextSyntheticClientAddress(),
                ...options.forwardedHeaders,
            },
            method: 'POST',
        }),
    );
    const body = (await response.json()) as { url?: string };
    const url = body.url ? new URL(body.url) : undefined;
    const state = url?.searchParams.get('state') ?? undefined;
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];

    if (
        !response.ok ||
        url?.hostname !== 'accounts.google.com' ||
        !state ||
        !cookie ||
        !url.searchParams.has('nonce') ||
        !url.searchParams.has('code_challenge')
    ) {
        throw new Error(
            'Google authorization did not bind state, nonce, PKCE, and the browser attempt.',
        );
    }

    oauthStateIdentifiers.add(state);
    return { cookie, state, url };
}

export function assertSafeLoginFailure(response: Response, message: string): void {
    const location = response.headers.get('location');
    const redirect = location ? new URL(location, environment.auth.baseUrl) : undefined;
    if (
        response.ok ||
        !redirect ||
        redirect.pathname !== '/login' ||
        redirect.searchParams.has('error_description')
    ) {
        throw new Error(message);
    }
}

export function responseCookieHeader(response: Response): string {
    return response.headers
        .getSetCookie()
        .map((value) => value.split(';', 1)[0])
        .join('; ');
}

export function mergeCookieHeaders(...headers: Array<string | null>): string {
    const cookies = new Map<string, string>();
    for (const header of headers) {
        for (const cookie of header?.split(/;\s*/) ?? []) {
            const separator = cookie.indexOf('=');
            if (separator > 0) {
                cookies.set(cookie.slice(0, separator), cookie);
            }
        }
    }
    return [...cookies.values()].join('; ');
}

export async function completeGoogleSignIn(code: string) {
    const attempt = await startGoogleSignIn(deterministicAuth);
    const response = await submitGoogleCallback(attempt, code);
    return { response, sessionCookie: responseCookieHeader(response) };
}

export async function submitGoogleCallback(
    attempt: { cookie: string; state: string },
    code: string,
): Promise<Response> {
    const callbackUrl = new URL('/api/auth/callback/google', environment.auth.baseUrl);
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('state', attempt.state);
    return deterministicAuth.handler(
        new Request(callbackUrl, { headers: { cookie: attempt.cookie } }),
    );
}

export async function startAppleSignIn(
    identityAuth = auth,
    options: {
        headers?: ConstructorParameters<typeof Headers>[0];
        link?: boolean;
        returnTo?: string;
    } = {},
): Promise<{ cookie: string; state: string; url: URL }> {
    const pathname = options.link ? '/api/auth/link-social' : '/api/auth/sign-in/social';
    const response = await identityAuth.handler(
        new Request(`${environment.auth.baseUrl}${pathname}`, {
            body: JSON.stringify({
                callbackURL: options.returnTo ?? '/app',
                disableRedirect: true,
                provider: 'apple',
            }),
            headers: {
                'content-type': 'application/json',
                origin: environment.auth.baseUrl,
                'x-forwarded-for': nextSyntheticClientAddress(),
                ...Object.fromEntries(new Headers(options.headers).entries()),
            },
            method: 'POST',
        }),
    );
    const body = (await response.json()) as { url?: string };
    const url = body.url ? new URL(body.url) : undefined;
    const state = url?.searchParams.get('state') ?? undefined;
    const initiatingCookie = new Headers(options.headers).get('cookie');
    const responseCookie = response.headers
        .getSetCookie()
        .map((value) => value.split(';', 1)[0])
        .join('; ');
    const cookie = mergeCookieHeaders(initiatingCookie, responseCookie);

    if (
        !response.ok ||
        url?.hostname !== 'appleid.apple.com' ||
        !state ||
        !cookie ||
        !url.searchParams.has('nonce') ||
        !url.searchParams.has('code_challenge') ||
        url.searchParams.get('response_mode') !== 'form_post'
    ) {
        throw new Error(
            `Apple authorization did not bind the browser attempt (status=${response.status}, host=${url?.hostname ?? 'none'}, state=${Boolean(state)}, cookie=${Boolean(cookie)}, nonce=${Boolean(url?.searchParams.has('nonce'))}, pkce=${Boolean(url?.searchParams.has('code_challenge'))}, formPost=${url?.searchParams.get('response_mode') === 'form_post'}).`,
        );
    }

    oauthStateIdentifiers.add(state);
    return { cookie, state, url };
}

export async function submitAppleCallback(
    attempt: { cookie: string; state: string },
    code: string,
    user?: Readonly<Record<string, unknown>>,
): Promise<Response> {
    const postResponse = await postAppleCallback(attempt, code, user);
    const location = postResponse.headers.get('location');
    const redirect = location ? new URL(location, deterministicHttpBaseUrl) : undefined;
    if (
        postResponse.status !== 303 ||
        !redirect ||
        redirect.searchParams.get('code') !== code ||
        redirect.searchParams.get('state') !== attempt.state ||
        [...redirect.searchParams.keys()].some((key) => key !== 'code' && key !== 'state')
    ) {
        throw new Error(
            'The Apple form POST did not use the profile-free server-side callback handoff.',
        );
    }
    return fetch(redirect, {
        headers: { cookie: attempt.cookie },
        redirect: 'manual',
    });
}

export async function postAppleCallback(
    attempt: { cookie: string; state: string },
    code: string,
    user?: Readonly<Record<string, unknown>>,
    sourceAddress = nextSyntheticClientAddress(),
): Promise<Response> {
    const body = new URLSearchParams({ code, state: attempt.state });
    if (user) {
        body.set('user', JSON.stringify(user));
    }
    return fetch(`${deterministicHttpBaseUrl}/api/auth/callback/apple`, {
        body,
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: attempt.cookie,
            'x-forwarded-for': sourceAddress,
        },
        method: 'POST',
        redirect: 'manual',
    });
}

export async function completeAppleSignIn(code: string, user?: Readonly<Record<string, unknown>>) {
    const attempt = await startAppleSignIn(deterministicAuth);
    const response = await submitAppleCallback(attempt, code, user);
    return { response, sessionCookie: responseCookieHeader(response) };
}

export async function waitForBlockedIdentityLock(
    lockKey: string,
    expectedWaiters: number,
): Promise<void> {
    const timeoutAt = Date.now() + 5_000;
    do {
        const rows = await database.$queryRaw<Array<{ waiting: bigint }>>`
      SELECT COUNT(*) AS waiting
      FROM pg_locks
      WHERE locktype = 'advisory'
        AND NOT granted
        AND classid::bigint = ((hashtextextended(${lockKey}, 0) >> 32) & 4294967295)
        AND objid::bigint = (hashtextextended(${lockKey}, 0) & 4294967295)
    `;
        if (Number(rows[0]?.waiting ?? 0) >= expectedWaiters) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    } while (Date.now() < timeoutAt);
    throw new Error(
        `The identity lock did not serialize ${expectedWaiters} concurrent operations.`,
    );
}

const authContext = await auth.$context;
export const helpers = (
    authContext as typeof authContext & {
        test: {
            login(input: { userId: string }): Promise<{
                cookies: Array<{
                    httpOnly?: boolean;
                    name: string;
                    sameSite?: string;
                    secure?: boolean;
                }>;
                headers: Headers;
                token: string;
            }>;
        };
    }
).test;

/** Closes the check server and removes every row this run created. */
export async function cleanUpAuthCheck(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        deterministicHttpServer.close((error) => (error ? reject(error) : resolve()));
    });
    if (userIds.size > 0) {
        await database.user.deleteMany({ where: { id: { in: [...userIds] } } });
    }
    if (oauthStateIdentifiers.size > 0) {
        await database.authVerification.deleteMany({
            where: { identifier: { in: [...oauthStateIdentifiers] } },
        });
    }
    const createdRateLimitIds = (await database.authRateLimit.findMany({ select: { id: true } }))
        .map(({ id }) => id)
        .filter((id) => !existingRateLimitIds.has(id));
    if (createdRateLimitIds.length > 0) {
        await database.authRateLimit.deleteMany({ where: { id: { in: createdRateLimitIds } } });
    }
    await database.$disconnect();
}
