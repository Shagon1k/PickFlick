import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import { isAllowedAuthReturnTarget } from '@pickflick/contracts';
import type { PrismaClient } from '@pickflick/database';
import { APIError, betterAuth, type BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';

import { createAppleClientSecret } from './apple-client-secret.js';

const DAY_SECONDS = 24 * 60 * 60;

/** `cf-connecting-ip` is trusted only behind Cloudflare; local runs use the proxy chain. */
function clientAddressHeader(environment: TRuntimeEnvironment): string {
    return environment.auth.secureCookies ? 'cf-connecting-ip' : 'x-forwarded-for';
}

function loginPath(returnTo: string): string {
    return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

function nameFromEmail(email: string | undefined): string {
    return email?.split('@')[0] || 'PickFlick member';
}

export function createAuth(
    environment: TRuntimeEnvironment,
    prisma: PrismaClient,
    plugins: BetterAuthPlugin[] = [],
) {
    const { auth } = environment;
    const sessionCookie = auth.secureCookies
        ? '__Host-pickflick.session_token'
        : 'pickflick.session_token';

    return betterAuth({
        appName: 'PickFlick',
        baseURL: auth.baseUrl,
        basePath: '/api/auth',
        secret: auth.secret,
        trustedOrigins: [auth.baseUrl],
        database: prismaAdapter(prisma, { provider: 'postgresql', transaction: true }),
        advanced: {
            database: { generateId: 'uuid' },
            ipAddress: { ipAddressHeaders: [clientAddressHeader(environment)] },
            // The `__Host-` cookie name already implies Secure; attributes stay explicit below.
            useSecureCookies: false,
            defaultCookieAttributes: {
                httpOnly: true,
                path: '/',
                sameSite: 'lax',
                secure: auth.secureCookies,
            },
            cookies: { session_token: { name: sessionCookie } },
        },
        socialProviders: {
            google: {
                clientId: auth.googleClientId,
                clientSecret: auth.googleClientSecret,
                scope: ['openid', 'email', 'profile'],
            },
            ...(auth.appleSignInEnabled
                ? {
                      apple: {
                          clientId: auth.appleClientId,
                          clientSecret: createAppleClientSecret(auth),
                          // Apple shares a name only on first sign-in; fall back to the email.
                          mapProfileToUser: (profile: { name?: string; email?: string }) => ({
                              name: profile.name || nameFromEmail(profile.email),
                          }),
                      },
                  }
                : {}),
        },
        account: {
            modelName: 'providerAccount',
            fields: { accountId: 'providerSubject', providerId: 'provider' },
            encryptOAuthTokens: true,
            storeStateStrategy: 'database',
            accountLinking: { enabled: false },
        },
        emailAndPassword: { enabled: false },
        session: {
            modelName: 'authSession',
            expiresIn: 7 * DAY_SECONDS,
            updateAge: DAY_SECONDS,
        },
        user: { modelName: 'user', fields: { name: 'displayName' } },
        verification: { modelName: 'authVerification' },
        rateLimit: {
            enabled: true,
            storage: 'database',
            modelName: 'authRateLimit',
            window: 60,
            max: 60,
            customRules: { '/sign-in/social': { window: 60, max: 10 } },
        },
        hooks: {
            before: createAuthMiddleware(async (context) => {
                if (context.path !== '/sign-in/social') {
                    return;
                }
                const returnTo: unknown = context.body?.callbackURL;
                if (!isAllowedAuthReturnTarget(returnTo)) {
                    throw APIError.from('BAD_REQUEST', {
                        code: 'INVALID_RETURN_TARGET',
                        message: 'The sign-in destination is not allowed.',
                    });
                }
                context.body.newUserCallbackURL = returnTo;
                context.body.errorCallbackURL = loginPath(returnTo);
            }),
        },
        databaseHooks: {
            user: {
                create: {
                    before: async (user) => {
                        if (!user.emailVerified) {
                            throw APIError.from('FORBIDDEN', {
                                code: 'EMAIL_NOT_VERIFIED',
                                message: 'Your sign-in provider must verify your email.',
                            });
                        }
                    },
                },
            },
            // Sign-in needs only the provider subject, so provider tokens are never stored.
            account: {
                create: {
                    before: async (account) => ({ data: { ...account, ...noProviderTokens } }),
                },
                update: {
                    before: async (account) => ({ data: { ...account, ...noProviderTokens } }),
                },
            },
            session: {
                create: {
                    before: async (session) => {
                        const user = await prisma.user.findUnique({
                            where: { id: session.userId },
                            select: { status: true },
                        });
                        if (user?.status !== 'ACTIVE') {
                            throw APIError.from('FORBIDDEN', {
                                code: 'ACCOUNT_INACTIVE',
                                message: 'Unable to sign in.',
                            });
                        }
                    },
                },
            },
        },
        onAPIError: { errorURL: `${auth.baseUrl}/login` },
        plugins,
        telemetry: { enabled: false },
    });
}

const noProviderTokens = {
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
};

export type TAuth = ReturnType<typeof createAuth>;
