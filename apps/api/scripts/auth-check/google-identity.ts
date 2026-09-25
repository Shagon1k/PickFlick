import { randomUUID } from 'node:crypto';

import {
    authorizationCodeExchanges,
    conflictEmail,
    database,
    email,
    environment,
    nextSyntheticClientAddress,
} from './context.js';
import {
    assertSafeLoginFailure,
    auth,
    completeGoogleSignIn,
    deterministicAuth,
    oauthStateIdentifiers,
    startGoogleSignIn,
    submitGoogleCallback,
    userIds,
} from './harness.js';

export async function checkGoogleIdentity(userId: string) {
    await database.user.delete({ where: { id: userId } });
    userIds.delete(userId);

    const registered = await completeGoogleSignIn('new-user');
    if (
        registered.response.status !== 302 ||
        registered.response.headers.get('location') !== '/app'
    ) {
        throw new Error('A new Google User did not reach the validated application return target.');
    }
    const registeredUser = await database.user.findUnique({ where: { email } });
    if (!registeredUser) {
        throw new Error('The deterministic Google callback did not create a User.');
    }
    userIds.add(registeredUser.id);
    const providerAccount = await database.providerAccount.findUnique({
        where: {
            provider_providerSubject: {
                provider: 'google',
                providerSubject: 'google-auth-check-subject',
            },
        },
    });
    if (
        !providerAccount ||
        providerAccount.userId !== registeredUser.id ||
        providerAccount.accessToken ||
        providerAccount.refreshToken ||
        providerAccount.idToken ||
        providerAccount.scope
    ) {
        throw new Error(
            'Google identity persistence retained provider credentials or lost the provider subject binding.',
        );
    }
    const registeredSession = await deterministicAuth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/get-session`, {
            headers: { cookie: registered.sessionCookie },
        }),
    );
    const registeredSessionBody = (await registeredSession.json()) as {
        user?: { id?: string };
    } | null;
    if (registeredSessionBody?.user?.id !== registeredUser.id) {
        throw new Error('A new Google User did not receive a resolvable database session.');
    }

    const googleLinkHeaders = new Headers({
        'content-type': 'application/json',
        cookie: registered.sessionCookie,
        origin: environment.auth.baseUrl,
        'x-forwarded-for': nextSyntheticClientAddress(),
    });
    const googleLink = await auth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/link-social`, {
            body: JSON.stringify({
                callbackURL: '/app',
                disableRedirect: true,
                loginHint: 'caller-controlled@example.invalid',
                provider: 'google',
            }),
            headers: googleLinkHeaders,
            method: 'POST',
        }),
    );
    const googleLinkBody = (await googleLink.json()) as { url?: string };
    const googleLinkUrl = googleLinkBody.url ? new URL(googleLinkBody.url) : undefined;
    const googleLinkState = googleLinkUrl?.searchParams.get('state');
    if (!googleLink.ok || !googleLinkState || googleLinkUrl.searchParams.has('login_hint')) {
        throw new Error('An explicit Google link retained a caller-controlled login hint.');
    }
    oauthStateIdentifiers.add(googleLinkState);

    const returning = await completeGoogleSignIn('returning-user');
    if (
        returning.response.status !== 302 ||
        returning.response.headers.get('location') !== '/app'
    ) {
        throw new Error(
            'A returning Google User did not reach the validated application return target.',
        );
    }
    const usersAfterReturn = await database.user.findMany({
        where: {
            providerAccounts: {
                some: { provider: 'google', providerSubject: 'google-auth-check-subject' },
            },
        },
    });
    if (
        usersAfterReturn.length !== 1 ||
        usersAfterReturn[0]?.id !== registeredUser.id ||
        usersAfterReturn[0]?.email !== email
    ) {
        throw new Error('A returning Google subject did not resolve to exactly one existing User.');
    }

    const concurrentAttempt = await startGoogleSignIn(deterministicAuth);
    const sessionsBeforeConcurrentCallbacks = await database.authSession.count({
        where: { userId: registeredUser.id },
    });
    const exchangesBeforeConcurrentCallbacks = authorizationCodeExchanges.length;
    const concurrentResponses = await Promise.all([
        submitGoogleCallback(concurrentAttempt, 'concurrent-one'),
        submitGoogleCallback(concurrentAttempt, 'concurrent-two'),
    ]);
    const successfulConcurrentResponses = concurrentResponses.filter(
        (response) => response.status === 302 && response.headers.get('location') === '/app',
    );
    const rejectedConcurrentResponses = concurrentResponses.filter(
        (response) => !successfulConcurrentResponses.includes(response),
    );
    if (successfulConcurrentResponses.length !== 1 || rejectedConcurrentResponses.length !== 1) {
        throw new Error(
            'Concurrent callbacks did not enforce one successful use of the OAuth state.',
        );
    }
    assertSafeLoginFailure(
        rejectedConcurrentResponses[0]!,
        'A concurrent OAuth-state replay did not fail safely.',
    );
    if (authorizationCodeExchanges.length - exchangesBeforeConcurrentCallbacks !== 1) {
        throw new Error('A concurrent OAuth-state replay reached the provider code exchange.');
    }
    const sessionsAfterConcurrentCallbacks = await database.authSession.count({
        where: { userId: registeredUser.id },
    });
    if (sessionsAfterConcurrentCallbacks !== sessionsBeforeConcurrentCallbacks + 1) {
        throw new Error(
            'Concurrent callbacks issued more than one database session from one OAuth state.',
        );
    }

    const conflictingUserId = randomUUID();
    userIds.add(conflictingUserId);
    await database.user.create({
        data: {
            id: conflictingUserId,
            displayName: 'Conflict User',
            email: conflictEmail,
            emailVerified: true,
        },
    });
    const conflict = await completeGoogleSignIn('email-conflict');
    assertSafeLoginFailure(
        conflict.response,
        'A case-insensitive unlinked Google identity matched an existing email unsafely.',
    );
    const conflictLocation = new URL(
        conflict.response.headers.get('location') ?? '',
        environment.auth.baseUrl,
    );
    if (conflictLocation.searchParams.get('error') !== 'account_not_linked') {
        throw new Error('An email conflict did not return the stable account-not-linked error.');
    }
    if (
        await database.providerAccount.findUnique({
            where: {
                provider_providerSubject: {
                    provider: 'google',
                    providerSubject: 'google-conflict-subject',
                },
            },
        })
    ) {
        throw new Error(
            'An email-conflicting Google identity was persisted despite linking being disabled.',
        );
    }
    return { providerAccount, registered, registeredUser };
}

export type GoogleIdentityResult = Awaited<ReturnType<typeof checkGoogleIdentity>>;
