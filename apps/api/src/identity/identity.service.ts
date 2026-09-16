import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { isAllowedAuthReturnTarget } from "@pickflick/contracts";
import { createDatabaseClient } from "@pickflick/database";
import type { ApplicationLogger } from "@pickflick/observability";
import { APIError, betterAuth, type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { toNodeHandler } from "better-auth/node";

import { APPLICATION_LOGGER, RUNTIME_ENVIRONMENT } from "../runtime.tokens.js";
import { safeAuthenticationResponsePlugin } from "./auth-response.js";
import { googleOidcProvider } from "./google-provider.js";

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
      encryptOAuthTokens: true,
      updateAccountOnSignIn: false,
      storeAccountCookie: false,
      storeStateStrategy: "database",
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
        trustedProviders: ["google"],
        updateUserInfoOnLink: false,
      },
    },
    emailAndPassword: { enabled: false },
    plugins: [googleOidcProvider(environment), ...plugins, safeAuthenticationResponsePlugin(environment.auth.baseUrl)],
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
        "/callback/*": { window: 60, max: 30 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path === "/sign-in/social") {
          if (context.body?.provider !== "google") {
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
          context.body.errorCallbackURL = "/login";
          context.body.newUserCallbackURL = context.body.callbackURL;
        }
        if (context.path === "/sign-out" && context.body?.callbackURL) {
          context.body.callbackURL = "/login";
        }
      }),
    },
    databaseHooks: {
      account: {
        create: {
          before: async () => ({ data: discardedProviderCredentialData }),
        },
        update: {
          before: async () => ({ data: discardedProviderCredentialData }),
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
    this.handler = toNodeHandler(this.auth);
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }
}
