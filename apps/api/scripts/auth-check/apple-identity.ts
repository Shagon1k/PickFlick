import { normalizeAppleDisplayName } from '../../src/identity/apple-profile.js';
import type { AuthenticatedPrincipal } from '../../src/identity/authorization.types.js';
import { appleEmail, database, environment, nextSyntheticClientAddress } from './context.js';
import {
    assertSafeLoginFailure,
    completeAppleSignIn,
    deterministicAuth,
    deterministicAuthorization,
    postAppleCallback,
    startAppleSignIn,
    userIds,
} from './harness.js';

export async function checkAppleIdentity(adminPrincipal: AuthenticatedPrincipal) {
    const amplificationAttempt = await startAppleSignIn(deterministicAuth);
    const amplificationAddress = nextSyntheticClientAddress();
    const amplificationResponses: Response[] = [];
    for (let index = 0; index < 11; index += 1) {
        amplificationResponses.push(
            await postAppleCallback(
                amplificationAttempt,
                `amplification-${index}`,
                { name: { firstName: `Attempt ${index}` } },
                amplificationAddress,
            ),
        );
    }
    if (
        amplificationResponses.slice(0, 10).some(({ status }) => status !== 303) ||
        amplificationResponses[10]?.status !== 429
    ) {
        throw new Error('The Apple callback POST boundary did not enforce its request limit.');
    }
    const amplificationHandoffs = await database.authVerification.findMany({
        where: { identifier: { startsWith: 'apple-callback:' } },
    });
    if (amplificationHandoffs.length !== 1) {
        throw new Error('One pending Apple state created more than one callback handoff.');
    }
    await database.authVerification.update({
        data: { expiresAt: new Date(Date.now() - 1_000) },
        where: { id: amplificationHandoffs[0]!.id },
    });
    const cleanupAttempt = await startAppleSignIn(deterministicAuth);
    const cleanupPost = await postAppleCallback(cleanupAttempt, 'cleanup-trigger', {
        name: { firstName: 'Cleanup' },
    });
    if (
        cleanupPost.status !== 303 ||
        (await database.authVerification.findUnique({
            where: { id: amplificationHandoffs[0]!.id },
        }))
    ) {
        throw new Error('An expired Apple callback handoff was not removed.');
    }
    await database.authVerification.deleteMany({
        where: { identifier: { startsWith: 'apple-callback:' } },
    });

    const appleDeniedAttempt = await startAppleSignIn(deterministicAuth);
    const appleDeniedUrl = new URL('/api/auth/callback/apple', environment.auth.baseUrl);
    appleDeniedUrl.searchParams.set('error', 'access_denied');
    appleDeniedUrl.searchParams.set('error_description', 'provider-secret-detail');
    appleDeniedUrl.searchParams.set('state', appleDeniedAttempt.state);
    const appleDenied = await deterministicAuth.handler(
        new Request(appleDeniedUrl, { headers: { cookie: appleDeniedAttempt.cookie } }),
    );
    assertSafeLoginFailure(
        appleDenied,
        'An Apple provider denial did not return a safe Login failure.',
    );

    const unverifiedApple = await completeAppleSignIn('apple-unverified', {
        name: { firstName: 'Unverified', lastName: 'Apple' },
    });
    assertSafeLoginFailure(unverifiedApple.response, 'An unverified new Apple email was accepted.');
    const unverifiedLocation = new URL(
        unverifiedApple.response.headers.get('location') ?? '',
        environment.auth.baseUrl,
    );
    if (unverifiedLocation.searchParams.get('error') !== 'apple_email_not_verified') {
        throw new Error('An unverified Apple email did not return the stable provider error.');
    }

    const longAppleLastName = `First ${'Return '.repeat(50)}`;
    const expectedAppleDisplayName = normalizeAppleDisplayName(`Apple ${longAppleLastName}`);
    const registeredApple = await completeAppleSignIn('apple-new-user', {
        email: appleEmail,
        name: { firstName: '\u0000Apple\u200b', lastName: longAppleLastName },
    });
    if (
        registeredApple.response.status !== 302 ||
        registeredApple.response.headers.get('location') !== '/app'
    ) {
        throw new Error('A new Apple User did not reach the validated application return target.');
    }
    const appleUser = await database.user.findUnique({ where: { email: appleEmail } });
    if (
        !appleUser ||
        appleUser.displayName !== expectedAppleDisplayName ||
        [...appleUser.displayName].length > 200
    ) {
        throw new Error('Apple first-return profile fields did not safely bootstrap the new User.');
    }
    userIds.add(appleUser.id);
    const appleAccount = await database.providerAccount.findUnique({
        where: {
            provider_providerSubject: {
                provider: 'apple',
                providerSubject: 'apple-auth-check-subject',
            },
        },
    });
    if (
        !appleAccount ||
        appleAccount.userId !== appleUser.id ||
        appleAccount.providerEmail !== appleEmail ||
        appleAccount.providerDisplayName !== expectedAppleDisplayName ||
        appleAccount.accessToken ||
        appleAccount.refreshToken ||
        appleAccount.idToken ||
        appleAccount.scope
    ) {
        throw new Error(
            'Apple identity persistence lost first-return fields or retained provider credentials.',
        );
    }

    const returningApple = await completeAppleSignIn('apple-returning');
    if (
        returningApple.response.status !== 302 ||
        returningApple.response.headers.get('location') !== '/app'
    ) {
        throw new Error(
            'A known Apple subject could not sign in after Apple omitted later profile fields.',
        );
    }
    const appleUserAfterReturn = await database.user.findUnique({ where: { id: appleUser.id } });
    if (
        appleUserAfterReturn?.displayName !== expectedAppleDisplayName ||
        appleUserAfterReturn.email !== appleEmail
    ) {
        throw new Error(
            'A later Apple callback erased first-return profile fields or moved the identity by email.',
        );
    }

    await deterministicAuthorization.suspendUser(adminPrincipal, appleUser.id);
    const suspendedAppleReturn = await completeAppleSignIn('apple-returning');
    assertSafeLoginFailure(
        suspendedAppleReturn.response,
        'A suspended User received a fresh session from a returning provider sign-in.',
    );
    if ((await database.authSession.count({ where: { userId: appleUser.id } })) !== 0) {
        throw new Error('A returning provider sign-in persisted a session for a suspended User.');
    }

    const appleConflict = await completeAppleSignIn('apple-conflict', {
        name: { firstName: 'Conflict', lastName: 'Apple' },
    });
    assertSafeLoginFailure(
        appleConflict.response,
        'An email-conflicting Apple identity matched an existing User.',
    );
    const appleConflictLocation = new URL(
        appleConflict.response.headers.get('location') ?? '',
        environment.auth.baseUrl,
    );
    if (appleConflictLocation.searchParams.get('error') !== 'account_not_linked') {
        throw new Error(
            'An Apple email conflict did not return the stable account-not-linked error.',
        );
    }
}
