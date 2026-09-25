import type { IncomingHttpHeaders } from "node:http";

import { Inject, Injectable } from "@nestjs/common";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { isAllowedAuthReturnTarget } from "@pickflick/contracts";
import { createDatabaseClient } from "@pickflick/database";
import type { ApplicationLogger } from "@pickflick/observability";
import { APIError, betterAuth, type BetterAuthPlugin } from "better-auth";
import {
  addOAuthServerContext,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  getOAuthState,
  getSessionFromCtx,
} from "better-auth/api";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";

import { DatabaseService } from "../database/database.service.js";
import { APPLICATION_LOGGER, RUNTIME_ENVIRONMENT } from "../runtime.tokens.js";
import { appleCallbackProfileHandoffPlugin } from "./apple-callback-handoff.js";
import { appleProviderAccountProfile } from "./apple-profile.js";
import { IdentityAuthorizationService } from "./authorization.service.js";
import type {
  AppRole,
  AuthenticatedPrincipal,
  IdentitySessionResolution,
} from "./authorization.types.js";
import { restrictAuthHandler } from "./auth-http.js";
import { safeAuthenticationResponsePlugin } from "./auth-response.js";
import { lockIdentityUser } from "./identity-lock.js";
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

const prismaAdapterOptions = {
  provider: "postgresql",
  transaction: true,
} as const;

function authenticationErrorCallback(baseUrl: string, returnTo: string): string {
  const errorCallbackURL = new URL("/login", baseUrl);
  errorCallbackURL.searchParams.set("returnTo", returnTo);
  return `${errorCallbackURL.pathname}${errorCallbackURL.search}`;
}

function isFreshSession(createdAt: Date | string): boolean {
  const age = Date.now() - new Date(createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < fifteenMinutesInSeconds * 1_000;
}

function boundaryOwnsRateLimit(): false {
  return false;
}

export type IdentityAuth = ReturnType<typeof createIdentityAuth>;

function serializedIdentityAdapter(
  database: ReturnType<typeof createDatabaseClient>,
  logger: ApplicationLogger,
) {
  const adapter = prismaAdapter(database, prismaAdapterOptions);

  return ((options) => {
    const configuredAdapter = adapter(options);
    return {
      ...configuredAdapter,
      create: async (input) => {
        if (input.model !== "session") {
          return configuredAdapter.create(input);
        }

        const userId = input.data.userId;
        if (typeof userId !== "string") {
          throw new Error("An authentication session requires a User identifier.");
        }

        return database.$transaction(async (transaction) => {
          await lockIdentityUser(transaction, userId);
          const user = await transaction.user.findUnique({
            select: { status: true },
            where: { id: userId },
          });
          if (user?.status !== "ACTIVE") {
            logger.warn(
              { event: "auth.session.denied", reason: "inactive_user" },
              "Authentication session creation denied.",
            );
            throw APIError.from("FORBIDDEN", {
              code: "ACCOUNT_INACTIVE",
              message: "Unable to sign in.",
            });
          }

          const transactionAdapter = prismaAdapter(transaction as never, {
            ...prismaAdapterOptions,
            transaction: false,
          })(options);
          return transactionAdapter.create(input);
        });
      },
    };
  }) satisfies typeof adapter;
}

export function createIdentityAuth(
  environment: RuntimeEnvironment,
  database: ReturnType<typeof createDatabaseClient>,
  logger: ApplicationLogger,
  plugins: BetterAuthPlugin[] = [],
) {
  const supportedProviders = new Set(environment.auth.appleSignInEnabled ? ["apple", "google"] : ["google"]);
  const sessionCookieName = environment.auth.secureCookies
    ? "__Host-pickflick.session_token"
    : "pickflick.session_token";

  return betterAuth({
    appName: "PickFlick",
    baseURL: environment.auth.baseUrl,
    basePath: "/api/auth",
    secret: environment.auth.secret,
    trustedOrigins: [environment.auth.baseUrl],
    database: serializedIdentityAdapter(database, logger),
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
        trustedProviders: [...supportedProviders],
        updateUserInfoOnLink: false,
      },
    },
    emailAndPassword: { enabled: false },
    plugins: [
      identityProviders(environment, database),
      ...(environment.auth.appleSignInEnabled ? [appleCallbackProfileHandoffPlugin(database)] : []),
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
      validateUserInfo: async ({ source, user }, context) => {
        if (source.action === "link-account") {
          const state = await getOAuthState();
          const initiatingSessionId = state?.serverContext?.pickFlickLinkSessionId;
          const session = await getAuthoritativeSessionFromCtx(context);
          if (
            typeof initiatingSessionId !== "string" ||
            !session?.session ||
            session.session.id !== initiatingSessionId ||
            session.user.id !== user.id ||
            !isFreshSession(session.session.createdAt)
          ) {
            return { error: "link_session_invalid" };
          }
        }
        if (source.action === "create-user" && source.oauth?.providerId === "google" && user.emailVerified !== true) {
          return { error: "google_email_not_verified" };
        }
        if (
          environment.auth.appleSignInEnabled &&
          source.action === "create-user" &&
          source.oauth?.providerId === "apple" &&
          user.emailVerified !== true
        ) {
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
        "/list-accounts": boundaryOwnsRateLimit,
        "/link-social": boundaryOwnsRateLimit,
        "/unlink-account": boundaryOwnsRateLimit,
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
          if (!isFreshSession(session.session.createdAt)) {
            throw APIError.from("FORBIDDEN", {
              code: "SESSION_NOT_FRESH",
              message: "The session is not fresh enough.",
            });
          }
          await addOAuthServerContext({ pickFlickLinkSessionId: session.session.id });
          const callbackURL = context.body.callbackURL;
          context.body.scopes = undefined;
          context.body.additionalParams = undefined;
          context.body.additionalData = undefined;
          context.body.loginHint = undefined;
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
          // The serialized adapter denies inactive Users under the identity lock before insertion.
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
export class IdentityService {
  private readonly database;
  private readonly authorization;
  readonly auth: IdentityAuth;
  readonly handler;

  constructor(
    @Inject(RUNTIME_ENVIRONMENT) environment: RuntimeEnvironment,
    @Inject(APPLICATION_LOGGER) logger: ApplicationLogger,
    databaseService: DatabaseService,
  ) {
    this.database = databaseService.client;
    this.auth = createIdentityAuth(environment, this.database, logger);
    this.authorization = new IdentityAuthorizationService(
      this.database,
      logger,
      (headers) => this.auth.api.getSession({
        headers: fromNodeHeaders(headers),
        query: { disableRefresh: true },
      }),
    );
    this.handler = restrictAuthHandler(toNodeHandler(this.auth), {
      appleSignInEnabled: environment.auth.appleSignInEnabled,
      clientAddressHeader: environment.appEnvironment === "uat" || environment.appEnvironment === "production"
        ? "cf-connecting-ip"
        : "x-forwarded-for",
      database: this.database,
      listAccounts: (request) => this.auth.api.listUserAccounts({
        asResponse: true,
        headers: fromNodeHeaders(request.headers),
      }),
      resolveSession: (request) => this.authorization.resolveSession(request.headers),
    });
  }

  resolveSession(headers: IncomingHttpHeaders): Promise<IdentitySessionResolution> {
    return this.authorization.resolveSession(headers);
  }

  authorizeBackgroundUser(userId: string, requiredRoles?: readonly AppRole[]): Promise<boolean> {
    return this.authorization.authorizeBackgroundUser(userId, requiredRoles);
  }

  revokeAllSessions(actor: AuthenticatedPrincipal, userId: string): Promise<void> {
    return this.authorization.revokeAllSessions(actor, userId);
  }

  setAppRole(actor: AuthenticatedPrincipal, userId: string, appRole: AppRole): Promise<void> {
    return this.authorization.setAppRole(actor, userId, appRole);
  }

  suspendUser(actor: AuthenticatedPrincipal, userId: string): Promise<void> {
    return this.authorization.suspendUser(actor, userId);
  }
}
