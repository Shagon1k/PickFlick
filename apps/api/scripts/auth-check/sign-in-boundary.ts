import { createIdentityAuth } from '../../src/identity/identity.service.js';
import { database, environment, logger } from './context.js';
import { assertSafeLoginFailure, auth, startGoogleSignIn } from './harness.js';

export async function checkSignInBoundary() {
    const crossOriginStart = await auth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/sign-in/social`, {
            body: JSON.stringify({ callbackURL: '/app', provider: 'google' }),
            headers: {
                'content-type': 'application/json',
                cookie: 'pickflick.session_token=forged',
                origin: 'https://untrusted.example.invalid',
            },
            method: 'POST',
        }),
    );
    if (crossOriginStart.ok) {
        throw new Error('A credentialed cross-origin authentication request was accepted.');
    }

    const unsafeReturnStart = await auth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/sign-in/social`, {
            body: JSON.stringify({
                callbackURL: 'https://untrusted.example.invalid/steal',
                provider: 'google',
            }),
            headers: { 'content-type': 'application/json', origin: environment.auth.baseUrl },
            method: 'POST',
        }),
    );
    if (unsafeReturnStart.ok) {
        throw new Error('An unsafe authentication return target was accepted.');
    }

    const restrictedAttempt = await startGoogleSignIn(auth, {
        additionalBody: {
            additionalParams: { access_type: 'offline', prompt: 'consent' },
            scopes: ['https://www.googleapis.com/auth/drive'],
        },
    });
    if (
        restrictedAttempt.url.searchParams.get('scope') !== 'openid email profile' ||
        restrictedAttempt.url.searchParams.get('access_type') !== 'online' ||
        restrictedAttempt.url.searchParams.has('prompt')
    ) {
        throw new Error(
            'Caller-controlled Google permissions or authorization parameters reached the provider URL.',
        );
    }

    const deployedAuth = createIdentityAuth(
        {
            ...environment,
            appEnvironment: 'uat',
            auth: { ...environment.auth, secureCookies: true },
        },
        database,
        logger,
    );
    const forwardedChain = '203.0.113.42, 198.51.100.8';
    for (const clientAddress of ['192.0.2.21', '192.0.2.22']) {
        await startGoogleSignIn(deployedAuth, {
            forwardedHeaders: {
                'cf-connecting-ip': clientAddress,
                'x-forwarded-for': forwardedChain,
            },
        });
    }
    const productionRateLimitKeys = await database.authRateLimit.findMany({
        where: { key: { in: ['192.0.2.21|/sign-in/social', '192.0.2.22|/sign-in/social'] } },
    });
    if (productionRateLimitKeys.length !== 2) {
        throw new Error(
            'Production-shaped forwarded requests did not retain distinct Cloudflare client identities.',
        );
    }

    const expiringAttempt = await startGoogleSignIn();
    await database.authVerification.updateMany({
        data: { expiresAt: new Date(Date.now() - 1_000) },
        where: { identifier: expiringAttempt.state },
    });
    const expiredCallbackUrl = new URL('/api/auth/callback/google', environment.auth.baseUrl);
    expiredCallbackUrl.searchParams.set('code', 'synthetic');
    expiredCallbackUrl.searchParams.set('state', expiringAttempt.state);
    const expiredCallback = await auth.handler(
        new Request(expiredCallbackUrl, { headers: { cookie: expiringAttempt.cookie } }),
    );
    assertSafeLoginFailure(expiredCallback, 'An expired OAuth state did not fail safely.');

    const replayedCallback = await auth.handler(
        new Request(expiredCallbackUrl, { headers: { cookie: expiringAttempt.cookie } }),
    );
    assertSafeLoginFailure(replayedCallback, 'A replayed OAuth state did not fail safely.');

    const invitationReturnTarget = '/invite/club/review-round-token';
    const deniedAttempt = await startGoogleSignIn(auth, { returnTo: invitationReturnTarget });
    const deniedCallbackUrl = new URL('/api/auth/callback/google', environment.auth.baseUrl);
    deniedCallbackUrl.searchParams.set('error', 'access_denied');
    deniedCallbackUrl.searchParams.set('error_description', 'provider-secret-detail');
    deniedCallbackUrl.searchParams.set('state', deniedAttempt.state);
    const deniedCallback = await auth.handler(
        new Request(deniedCallbackUrl, { headers: { cookie: deniedAttempt.cookie } }),
    );
    assertSafeLoginFailure(
        deniedCallback,
        'A provider denial did not return a safe Login failure.',
    );
    const deniedRedirect = new URL(
        deniedCallback.headers.get('location') ?? '',
        environment.auth.baseUrl,
    );
    if (deniedRedirect.searchParams.get('returnTo') !== invitationReturnTarget) {
        throw new Error('A provider denial discarded the validated invitation return target.');
    }

    const forgedCallback = await auth.handler(
        new Request(
            `${environment.auth.baseUrl}/api/auth/callback/google?code=synthetic&state=forged`,
        ),
    );
    assertSafeLoginFailure(forgedCallback, 'A forged OAuth callback did not fail safely.');
}
