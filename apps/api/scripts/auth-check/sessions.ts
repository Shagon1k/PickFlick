import { randomUUID } from 'node:crypto';

import { database, email, environment, nextSyntheticClientAddress } from './context.js';
import {
    auth,
    deterministicAuthorization,
    deterministicHttpBaseUrl,
    helpers,
    userIds,
} from './harness.js';

export async function checkSessionLifecycle() {
    const userId = randomUUID();
    userIds.add(userId);
    await database.user.create({
        data: { id: userId, displayName: 'Auth Check User', email, emailVerified: true },
    });
    const login = await helpers.login({ userId });
    const sessionCookie = login.cookies.find(({ name }) => name === 'pickflick.session_token');
    if (!sessionCookie?.httpOnly || sessionCookie.sameSite !== 'Lax' || sessionCookie.secure) {
        throw new Error(
            'The local session cookie does not match the reviewed opaque-cookie contract.',
        );
    }

    const storedSession = await database.authSession.findUnique({ where: { token: login.token } });
    if (!storedSession) {
        throw new Error('The deterministic login did not create a database session.');
    }

    const authenticated = await auth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/get-session`, { headers: login.headers }),
    );
    const authenticatedBody = (await authenticated.json()) as { user?: { id?: string } } | null;
    if (!authenticated.ok || authenticatedBody?.user?.id !== userId) {
        throw new Error('The database session did not resolve to its User.');
    }
    const resolvedSession = await deterministicAuthorization.resolveSession(
        Object.fromEntries(login.headers.entries()),
    );
    if (!resolvedSession.authorized || resolvedSession.principal.appRole !== 'USER') {
        throw new Error('The shared session resolver did not return current User authorization.');
    }
    const forgedSession = await deterministicAuthorization.resolveSession({
        cookie: 'pickflick.session_token=forged-private-token',
    });
    if (forgedSession.authorized || forgedSession.reason !== 'invalid_session') {
        throw new Error('The shared session resolver accepted a forged session.');
    }
    const forgedAccountProjection = await fetch(
        `${deterministicHttpBaseUrl}/api/auth/list-accounts`,
        {
            headers: { cookie: 'pickflick.session_token=forged-private-token' },
        },
    );
    if (forgedAccountProjection.status !== 401) {
        throw new Error('A forged session reached a protected authentication projection.');
    }
    const deniedRequestAddress = nextSyntheticClientAddress();
    const deniedProtectedResponses: Response[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
        deniedProtectedResponses.push(
            await fetch(`${deterministicHttpBaseUrl}/api/auth/link-social`, {
                body: JSON.stringify({ callbackURL: '/app', provider: 'google' }),
                headers: {
                    'content-type': 'application/json',
                    cookie: 'pickflick.session_token=forged-private-token',
                    origin: environment.auth.baseUrl,
                    'x-forwarded-for': deniedRequestAddress,
                },
                method: 'POST',
            }),
        );
    }
    if (
        deniedProtectedResponses.slice(0, 10).some(({ status }) => status !== 401) ||
        deniedProtectedResponses[10]?.status !== 429
    ) {
        throw new Error(
            'Denied protected authentication requests did not consume the configured abuse limit.',
        );
    }

    const expiredLogin = await helpers.login({ userId });
    await database.authSession.update({
        data: { expiresAt: new Date(Date.now() - 1_000) },
        where: { token: expiredLogin.token },
    });
    const expiredSession = await deterministicAuthorization.resolveSession(
        Object.fromEntries(expiredLogin.headers.entries()),
    );
    if (expiredSession.authorized || expiredSession.reason !== 'invalid_session') {
        throw new Error('The shared session resolver accepted an expired session.');
    }

    const rollingLogin = await helpers.login({ userId });
    const preRefreshExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1_000);
    await database.authSession.update({
        data: { expiresAt: preRefreshExpiry },
        where: { token: rollingLogin.token },
    });
    const rollingResponse = await fetch(`${deterministicHttpBaseUrl}/api/auth/get-session`, {
        headers: rollingLogin.headers,
    });
    const rolledSession = await database.authSession.findUnique({
        where: { token: rollingLogin.token },
    });
    if (
        !rollingResponse.ok ||
        !rollingResponse.headers
            .getSetCookie()
            .some((cookie) => cookie.startsWith('pickflick.session_token=')) ||
        !rolledSession ||
        rolledSession.expiresAt <= preRefreshExpiry
    ) {
        throw new Error('The session boundary discarded a rolling session cookie update.');
    }

    const signOutHeaders = new Headers(login.headers);
    signOutHeaders.set('content-type', 'application/json');
    signOutHeaders.set('origin', environment.auth.baseUrl);
    const signedOut = await auth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/sign-out`, {
            body: '{}',
            headers: signOutHeaders,
            method: 'POST',
        }),
    );
    if (
        !signedOut.ok ||
        (await database.authSession.findUnique({ where: { token: login.token } }))
    ) {
        throw new Error('Sign-out did not revoke the current database session immediately.');
    }

    const afterRevocation = await fetch(`${deterministicHttpBaseUrl}/api/auth/get-session`, {
        headers: login.headers,
    });
    if (
        !afterRevocation.ok ||
        (await afterRevocation.json()) !== null ||
        !afterRevocation.headers
            .getSetCookie()
            .some(
                (cookie) =>
                    cookie.startsWith('pickflick.session_token=') && /Max-Age=0/i.test(cookie),
            )
    ) {
        throw new Error('A revoked session remained usable or its browser cookie was not cleared.');
    }
    const revokedSession = await deterministicAuthorization.resolveSession(
        Object.fromEntries(login.headers.entries()),
    );
    if (revokedSession.authorized || revokedSession.reason !== 'invalid_session') {
        throw new Error('The shared session resolver accepted a revoked session.');
    }
    return { userId };
}
