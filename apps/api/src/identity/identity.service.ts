import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { isAllowedAuthReturnTarget } from "@pickflick/contracts";
import { createDatabaseClient } from "@pickflick/database";
import type { ApplicationLogger } from "@pickflick/observability";
import { APIError, betterAuth, type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { toNodeHandler } from "better-auth/node";

import { APPLICATION_LOGGER, RUNTIME_ENVIRONMENT } from "../runtime.tokens.js";
import { appleProviderAccountProfile } from "./apple-profile.js";
import { restrictAuthHandler } from "./auth-http.js";
import { safeAuthenticationResponsePlugin } from "./auth-response.js";
import { identityProviders } from "./identity-providers.js";

const sevenDaysInSeconds = 60 * 60 * 24 * 7;
const oneDayInSeconds = 60 * 60 * 24;
const fifteenMinutesInSeconds = 60 * 15;

const discardedProviderCredentialData = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: null,
} as const;

const supportedProviders = new Set(["apple", "google"]);

function authenticationErrorCallback(baseUrl: string, returnTo: string): string {
  const errorCallbackURL = new URL("/login", baseUrl);
  errorCallbackURL.searchParams.set("returnTo", returnTo);
  return `${errorCallbackURL.pathname}${errorCallbackURL.search}`;
}

export type IdentityAuth = ReturnType<typeof createIdentityAuth>;

export function createIdentityAuth(
  environment: RuntimeEnvironment,
  database: ReturnType<typeof createDatabaseClient>,
  logger: ApplicationLogger,
  plugins: BetterAuthPlugin[] = [],
) {
  const sessionCookieName = environment.auth.secureCookies
    ? "__Host-pickflick.session_token"
    : "pickflick.session_token";

  return betterAuth({
    appName: "PickFlick",
    baseURL: environment.auth.baseUrl,
    basePath: "/api/auth",
    secret: environment.auth.secret,
    trustedOrigins: [environment.auth.baseUrl],
    database: prismaAdapter(database, {
      provider: "postgresql",
      transaction: true,
    }),
    advanced: {
      database: { generateId: "uuid", validateSchema: true },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      ipAddress: {
        ipAddressHeaders: environment.appEnvironment === "uat" || environment.appEnvironment === "production"
          ? ["cf-connecting-ip"]
          : ["x-forwarded-for"],
      },
      // The durable cookie supplies the stricter __Host- prefix itself.
      // Attributes remain explicitly Secure in deployed environments.
      useSecureCookies: false,
      defaultCookieAttributes: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: environment.auth.secureCookies,
      },
      cookies: {
        session_token: {
          name: sessionCookieName,
          attributes: {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: environment.auth.secureCookies,
          },
        },
      },
    },
    account: {
      modelName: "providerAccount",
      fields: { accountId: "providerSubject", providerId: "provider" },
      additionalFields: {
        providerDisplayName: { type: "string", required: false, returned: false, input: false },
        providerEmail: { type: "string", required: false, returned: false, input: false },
      },
      encryptOAuthTokens: true,
      updateAccountOnSignIn: false,
      storeAccountCookie: false,
      storeStateStrategy: "database",
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        trustedProviders: ["apple", "google"],
        updateUserInfoOnLink: false,
      },
    },
    emailAndPassword: { enabled: false },
    plugins: [
      identityProviders(environment, database),
      ...plugins,
      safeAuthenticationResponsePlugin(environment.auth.baseUrl),
    ],
    session: {
      modelName: "authSession",
      expiresIn: sevenDaysInSeconds,
      updateAge: oneDayInSeconds,
      freshAge: fifteenMinutesInSeconds,
      cookieCache: { enabled: false },
    },
    user: {
      modelName: "user",
      fields: { name: "displayName" },
      validateUserInfo: ({ source, user }) => {
        if (source.action === "create-user" && source.oauth?.providerId === "google" && user.emailVerified !== true) {
          return { error: "google_email_not_verified" };
        }
        if (source.action === "create-user" && source.oauth?.providerId === "apple" && user.emailVerified !== true) {
          return { error: "apple_email_not_verified" };
        }
      },
    },
    verification: { modelName: "authVerification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "authRateLimit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/social": { window: 60, max: 10 },
        "/link-social": { window: 60, max: 10 },
        "/unlink-account": { window: 60, max: 10 },
        "/callback/*": { window: 60, max: 30 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path === "/sign-in/social") {
          if (!supportedProviders.has(context.body?.provider)) {
            logger.warn({ event: "auth.provider.rejected" }, "Unsupported identity provider rejected.");
            throw APIError.from("BAD_REQUEST", {
              code: "UNSUPPORTED_IDENTITY_PROVIDER",
              message: "This sign-in method is not available.",
            });
          }
          if (!isAllowedAuthReturnTarget(context.body.callbackURL)) {
            logger.warn({ event: "auth.return_target.rejected" }, "Unsafe authentication return target rejected.");
            throw APIError.from("BAD_REQUEST", {
              code: "INVALID_RETURN_TARGET",
              message: "The sign-in destination is not allowed.",
            });
          }
          const callbackURL = context.body.callbackURL;
          context.body.scopes = undefined;
          context.body.additionalParams = undefined;
          context.body.errorCallbackURL = authenticationErrorCallback(environment.auth.baseUrl, callbackURL);
          context.body.newUserCallbackURL = callbackURL;
        }
        if (context.path === "/link-social") {
          if (!supportedProviders.has(context.body?.provider) || context.body?.idToken) {
            logger.warn({ event: "auth.link.rejected" }, "Unsupported identity-link request rejected.");
            throw APIError.from("BAD_REQUEST", {
              code: "UNSUPPORTED_IDENTITY_LINK",
              message: "This sign-in method cannot be linked.",
            });
          }
          if (!isAllowedAuthReturnTarget(context.body.callbackURL)) {
            logger.warn({ event: "auth.return_target.rejected" }, "Unsafe identity-link return target rejected.");
            throw APIError.from("BAD_REQUEST", {
              code: "INVALID_RETURN_TARGET",
              message: "The linking destination is not allowed.",
            });
          }
          const session = await getSessionFromCtx(context);
          if (!session?.session) {
            throw APIError.from("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "Unauthorized" });
          }
          const sessionAge = Date.now() - new Date(session.session.createdAt).getTime();
          if (sessionAge >= fifteenMinutesInSeconds * 1_000) {
            throw APIError.from("FORBIDDEN", {
              code: "SESSION_NOT_FRESH",
              message: "The session is not fresh enough.",
            });
          }
          const callbackURL = context.body.callbackURL;
          context.body.scopes = undefined;
          context.body.additionalParams = undefined;
          context.body.additionalData = undefined;
          context.body.errorCallbackURL = authenticationErrorCallback(environment.auth.baseUrl, callbackURL);
        }
        if (context.path === "/sign-out" && context.body?.callbackURL) {
          context.body.callbackURL = "/login";
        }
      }),
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account, context) => ({
            data: {
              ...discardedProviderCredentialData,
              ...appleProviderAccountProfile(account, context?.query?.user ?? context?.body?.user),
            },
          }),
        },
        update: {
          before: async (account, context) => ({
            data: {
              ...discardedProviderCredentialData,
              ...appleProviderAccountProfile(account, context?.query?.user ?? context?.body?.user),
            },
          }),
        },
      },
      session: {
        create: {
          after: async () => {
            logger.info({ event: "auth.session.issued" }, "Authentication session issued.");
          },
        },
        delete: {
          after: async () => {
            logger.info({ event: "auth.session.revoked" }, "Authentication session revoked.");
          },
        },
      },
    },
    onAPIError: {
      errorURL: `${environment.auth.baseUrl}/login`,
      onError: () => {
        logger.warn({ event: "auth.request.failed" }, "Authentication request failed safely.");
      },
    },
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

@Injectable()
export class IdentityService implements OnModuleDestroy {
  private readonly database;
  readonly auth: IdentityAuth;
  readonly handler;

  constructor(
    @Inject(RUNTIME_ENVIRONMENT) environment: RuntimeEnvironment,
    @Inject(APPLICATION_LOGGER) logger: ApplicationLogger,
  ) {
    this.database = createDatabaseClient(environment.databaseUrl);
    this.auth = createIdentityAuth(environment, this.database, logger);
    this.handler = restrictAuthHandler(toNodeHandler(this.auth));
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }
}
