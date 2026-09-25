import type { BetterAuthPlugin } from 'better-auth';

import { normalizeAppleDisplayName } from '../../src/identity/apple-profile.js';
import {
    appleEmail,
    appleLinkEmail,
    appleOwnedEmail,
    authorizationCodeExchanges,
    conflictEmail,
    database,
    email,
} from './context.js';

export function deterministicGoogleProvider() {
    const provider = {
        id: 'google',
        name: 'Google',
        requiresIdTokenNonce: true,
        accountSubject: ({ profile }: { profile: { sub?: string } }) => profile.sub ?? '',
        async createAuthorizationURL({
            state,
            codeVerifier,
            redirectURI,
            idTokenNonce,
        }: {
            state: string;
            codeVerifier: string;
            redirectURI: string;
            idTokenNonce?: string;
        }) {
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.searchParams.set('state', state);
            url.searchParams.set('redirect_uri', redirectURI);
            url.searchParams.set('code_challenge', codeVerifier);
            if (idTokenNonce) {
                url.searchParams.set('nonce', idTokenNonce);
            }
            return url;
        },
        async validateAuthorizationCode({ code }: { code: string }) {
            authorizationCodeExchanges.push(code);
            return {
                accessToken: `access-${code}`,
                accessTokenExpiresAt: new Date(Date.now() + 60_000),
                idToken: code,
                refreshToken: `refresh-${code}`,
                refreshTokenExpiresAt: new Date(Date.now() + 120_000),
                scopes: ['openid', 'email', 'profile'],
            };
        },
        async getUserInfo(tokens: { expectedIdTokenNonce?: string; idToken?: string }) {
            if (!tokens.expectedIdTokenNonce || !tokens.idToken) {
                return null;
            }
            const returning = tokens.idToken === 'returning-user';
            const conflict = tokens.idToken === 'email-conflict';
            let providerEmail = returning ? `changed-${email}` : email;
            if (conflict) {
                providerEmail = conflictEmail.toUpperCase();
            }
            const user = {
                sub: conflict ? 'google-conflict-subject' : 'google-auth-check-subject',
                email: providerEmail,
                email_verified: !returning,
                name: 'Auth Check User',
                picture: 'https://images.example.invalid/auth-check.png',
            };
            return {
                data: user,
                user: {
                    email: user.email,
                    emailVerified: user.email_verified,
                    image: user.picture,
                    name: user.name,
                },
            };
        },
    };

    return provider;
}

export function deterministicAppleIdToken(profile: Readonly<Record<string, unknown>>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'synthetic' })).toString(
        'base64url',
    );
    const payload = Buffer.from(JSON.stringify(profile)).toString('base64url');
    return `${header}.${payload}.synthetic-signature`;
}

export function deterministicAppleProfile(code: string) {
    if (code === 'apple-conflict') {
        return {
            code,
            email: conflictEmail.toUpperCase(),
            email_verified: true,
            sub: 'apple-conflict-subject',
        };
    }
    if (code === 'apple-link') {
        return { code, email: appleLinkEmail, email_verified: 'true', sub: 'apple-linked-subject' };
    }
    if (code === 'apple-owned') {
        return { code, email: appleOwnedEmail, email_verified: true, sub: 'apple-owned-subject' };
    }
    if (code === 'apple-unverified') {
        return {
            code,
            email: `unverified-${appleEmail}`,
            email_verified: false,
            sub: 'apple-unverified-subject',
        };
    }
    if (code === 'apple-returning') {
        return { code, email_verified: false, sub: 'apple-auth-check-subject' };
    }
    return { code, email: appleEmail, email_verified: 'true', sub: 'apple-auth-check-subject' };
}

export function deterministicAppleProvider() {
    const provider = {
        id: 'apple',
        name: 'Apple',
        requiresIdTokenNonce: true,
        accountSubject: ({ profile }: { profile: { sub?: string } }) => profile.sub ?? '',
        async createAuthorizationURL({
            state,
            codeVerifier,
            redirectURI,
            idTokenNonce,
        }: {
            state: string;
            codeVerifier: string;
            redirectURI: string;
            idTokenNonce?: string;
        }) {
            const url = new URL('https://appleid.apple.com/auth/authorize');
            url.searchParams.set('state', state);
            url.searchParams.set('redirect_uri', redirectURI);
            url.searchParams.set('code_challenge', codeVerifier);
            url.searchParams.set('response_mode', 'form_post');
            if (idTokenNonce) {
                url.searchParams.set('nonce', idTokenNonce);
            }
            return url;
        },
        async validateAuthorizationCode({ code }: { code: string }) {
            authorizationCodeExchanges.push(code);
            const profile = deterministicAppleProfile(code);
            return {
                accessToken: `apple-access-${code}`,
                idToken: deterministicAppleIdToken(profile),
                refreshToken: `apple-refresh-${code}`,
                scopes: ['openid', 'email', 'name'],
            };
        },
        async getUserInfo(tokens: {
            expectedIdTokenNonce?: string;
            idToken?: string;
            user?: { name?: { firstName?: string; lastName?: string } };
        }) {
            if (!tokens.expectedIdTokenNonce || !tokens.idToken) {
                return null;
            }
            const payload = tokens.idToken.split('.')[1];
            const profile = payload
                ? (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ReturnType<
                      typeof deterministicAppleProfile
                  >)
                : undefined;
            if (!profile) {
                return null;
            }
            const existingAccount = await database.providerAccount.findUnique({
                where: {
                    provider_providerSubject: { provider: 'apple', providerSubject: profile.sub },
                },
                select: { providerEmail: true, user: { select: { email: true } } },
            });
            const emailVerified =
                profile.email_verified === true || profile.email_verified === 'true';
            const name =
                normalizeAppleDisplayName(
                    [tokens.user?.name?.firstName, tokens.user?.name?.lastName]
                        .filter(Boolean)
                        .join(' '),
                ) ?? '';
            return {
                data: { ...profile, name },
                user: {
                    email:
                        profile.email ??
                        existingAccount?.providerEmail ??
                        existingAccount?.user.email,
                    emailVerified: emailVerified || Boolean(existingAccount),
                    name,
                },
            };
        },
    };

    return provider;
}

export function deterministicProviders(): BetterAuthPlugin {
    return {
        id: 'pickflick-deterministic-providers',
        init: () => ({
            context: {
                socialProviders: [deterministicGoogleProvider(), deterministicAppleProvider()],
            },
        }),
    };
}
