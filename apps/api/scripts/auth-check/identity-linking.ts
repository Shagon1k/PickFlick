import { randomUUID } from 'node:crypto';

import {
    appleLinkEmail,
    appleOwnedEmail,
    database,
    email,
    environment,
    nextSyntheticClientAddress,
} from './context.js';
import {
    assertSafeLoginFailure,
    deterministicAuth,
    deterministicHttpBaseUrl,
    helpers,
    startAppleSignIn,
    submitAppleCallback,
    userIds,
} from './harness.js';
import type { GoogleIdentityResult } from './google-identity.js';

export async function checkIdentityLinking({
    providerAccount,
    registered,
    registeredUser,
}: GoogleIdentityResult) {
    const staleLogin = await helpers.login({ userId: registeredUser.id });
    await database.authSession.update({
        where: { token: staleLogin.token },
        data: { createdAt: new Date(Date.now() - 16 * 60 * 1_000) },
    });
    const staleLinkHeaders = new Headers(staleLogin.headers);
    staleLinkHeaders.set('content-type', 'application/json');
    staleLinkHeaders.set('origin', environment.auth.baseUrl);
    const staleLink = await deterministicAuth.handler(
        new Request(`${environment.auth.baseUrl}/api/auth/link-social`, {
            body: JSON.stringify({ callbackURL: '/app', disableRedirect: true, provider: 'apple' }),
            headers: staleLinkHeaders,
            method: 'POST',
        }),
    );
    const staleLinkBody = (await staleLink.json()) as { code?: string };
    if (staleLink.status !== 403 || staleLinkBody.code !== 'SESSION_NOT_FRESH') {
        throw new Error('A stale session created an explicit identity-link intent.');
    }

    const revokedCallbackLogin = await helpers.login({ userId: registeredUser.id });
    const revokedLinkAttempt = await startAppleSignIn(deterministicAuth, {
        headers: revokedCallbackLogin.headers,
        link: true,
    });
    await database.authSession.delete({ where: { token: revokedCallbackLogin.token } });
    const revokedLink = await submitAppleCallback(revokedLinkAttempt, 'apple-link');
    assertSafeLoginFailure(revokedLink, 'A revoked initiating session completed an identity link.');
    if (
        await database.providerAccount.findUnique({
            where: {
                provider_providerSubject: {
                    provider: 'apple',
                    providerSubject: 'apple-linked-subject',
                },
            },
        })
    ) {
        throw new Error('A revoked initiating session persisted an identity link.');
    }

    const staleCallbackLogin = await helpers.login({ userId: registeredUser.id });
    const staleCallbackAttempt = await startAppleSignIn(deterministicAuth, {
        headers: staleCallbackLogin.headers,
        link: true,
    });
    await database.authSession.update({
        where: { token: staleCallbackLogin.token },
        data: { createdAt: new Date(Date.now() - 16 * 60 * 1_000) },
    });
    const staleCallbackLink = await submitAppleCallback(staleCallbackAttempt, 'apple-link');
    assertSafeLoginFailure(
        staleCallbackLink,
        'A session that became stale completed an identity link.',
    );
    if (
        await database.providerAccount.findUnique({
            where: {
                provider_providerSubject: {
                    provider: 'apple',
                    providerSubject: 'apple-linked-subject',
                },
            },
        })
    ) {
        throw new Error('A session that became stale persisted an identity link.');
    }

    const appleLinkAttempt = await startAppleSignIn(deterministicAuth, {
        headers: { cookie: registered.sessionCookie },
        link: true,
    });
    const linkedApple = await submitAppleCallback(appleLinkAttempt, 'apple-link', {
        email: appleLinkEmail,
        name: { firstName: 'Linked', lastName: 'Apple' },
    });
    if (linkedApple.status !== 302 || linkedApple.headers.get('location') !== '/app') {
        throw new Error('A fresh explicit Apple link did not complete.');
    }
    const linkedAccount = await database.providerAccount.findUnique({
        where: {
            provider_providerSubject: {
                provider: 'apple',
                providerSubject: 'apple-linked-subject',
            },
        },
    });
    const googleUserAfterLink = await database.user.findUnique({
        where: { id: registeredUser.id },
    });
    if (
        linkedAccount?.userId !== registeredUser.id ||
        linkedAccount.providerEmail !== appleLinkEmail ||
        linkedAccount.providerDisplayName !== 'Linked Apple' ||
        googleUserAfterLink?.email !== email ||
        googleUserAfterLink.displayName !== registeredUser.displayName
    ) {
        throw new Error(
            'Explicit Apple relay linking changed the User profile or lost provider-owned fields.',
        );
    }

    const listedAccounts = await fetch(`${deterministicHttpBaseUrl}/api/auth/list-accounts`, {
        headers: { cookie: registered.sessionCookie },
    });
    const listedAccountBody = await listedAccounts.text();
    if (
        !listedAccounts.ok ||
        !listedAccountBody.includes('"provider":"apple"') ||
        /accountId|providerSubject|providerEmail|providerDisplayName|accessToken|refreshToken|idToken/.test(
            listedAccountBody,
        )
    ) {
        throw new Error('Linked-account listing exposed provider profile or credential fields.');
    }

    const ownedUserId = randomUUID();
    userIds.add(ownedUserId);
    const ownedAccount = await database.providerAccount.create({
        data: {
            provider: 'apple',
            providerEmail: appleOwnedEmail,
            providerSubject: 'apple-owned-subject',
            user: {
                create: {
                    id: ownedUserId,
                    displayName: 'Owned Apple User',
                    email: appleOwnedEmail,
                    emailVerified: true,
                },
            },
        },
    });
    const duplicateLinkAttempt = await startAppleSignIn(deterministicAuth, {
        headers: { cookie: registered.sessionCookie },
        link: true,
    });
    const duplicateLink = await submitAppleCallback(duplicateLinkAttempt, 'apple-owned');
    assertSafeLoginFailure(
        duplicateLink,
        'An Apple identity linked to another User was reassigned.',
    );
    const duplicateLocation = new URL(
        duplicateLink.headers.get('location') ?? '',
        environment.auth.baseUrl,
    );
    if (duplicateLocation.searchParams.get('error') !== 'account_not_linked') {
        throw new Error('A duplicate Apple identity exposed an unsafe linking error.');
    }
    const ownedAccountAfterLink = await database.providerAccount.findUnique({
        where: { id: ownedAccount.id },
    });
    if (ownedAccountAfterLink?.userId !== ownedUserId) {
        throw new Error('An Apple provider identity was reassigned to another User.');
    }

    const concurrentUnlink = (accountId: string) =>
        fetch(`${deterministicHttpBaseUrl}/api/auth/unlink-account`, {
            body: JSON.stringify({ accountId }),
            headers: {
                'content-type': 'application/json',
                cookie: registered.sessionCookie,
                origin: environment.auth.baseUrl,
                'x-forwarded-for': nextSyntheticClientAddress(),
            },
            method: 'POST',
        });
    const concurrentUnlinks = await Promise.all([
        concurrentUnlink(providerAccount.id),
        concurrentUnlink(linkedAccount.id),
    ]);
    const remainingLinkedAccounts = await database.providerAccount.count({
        where: { userId: registeredUser.id },
    });
    if (concurrentUnlinks.filter(({ ok }) => ok).length !== 1 || remainingLinkedAccounts !== 1) {
        throw new Error('Concurrent unlink requests removed every supported provider identity.');
    }

    const ownedLogin = await helpers.login({ userId: ownedUserId });
    const unlinkHeaders = new Headers(ownedLogin.headers);
    unlinkHeaders.set('content-type', 'application/json');
    unlinkHeaders.set('origin', environment.auth.baseUrl);
    unlinkHeaders.set('x-forwarded-for', nextSyntheticClientAddress());
    const unlinkLast = await fetch(`${deterministicHttpBaseUrl}/api/auth/unlink-account`, {
        body: JSON.stringify({ accountId: ownedAccount.id }),
        headers: unlinkHeaders,
        method: 'POST',
    });
    if (
        unlinkLast.ok ||
        !(await database.providerAccount.findUnique({ where: { id: ownedAccount.id } }))
    ) {
        throw new Error('A User was allowed to unlink their last supported provider identity.');
    }
}
