import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { createDatabaseClient } from "@pickflick/database";
import { createLogger } from "@pickflick/observability";
import { afterAll, describe, expect, it } from "vitest";

import { createIdentityAuth } from "../identity.service.js";

const database = createDatabaseClient("postgresql://pickflick:synthetic@127.0.0.1:5432/pickflick_test");
const logger = createLogger({ environment: "test", service: "api" });
const environment = {
  appEnvironment: "test",
  apiHost: "127.0.0.1",
  apiPort: 3001,
  shutdownTimeoutMilliseconds: 10_000,
  databaseUrl: "postgresql://pickflick:synthetic@127.0.0.1:5432/pickflick_test",
  redisUrl: "redis://127.0.0.1:6379/0",
  storage: {
    endpoint: "http://127.0.0.1:9000",
    region: "us-east-1",
    bucket: "pickflick-test",
    accessKey: "synthetic",
    secretKey: "synthetic",
    forcePathStyle: true,
  },
  resend: {
    apiKey: "local-disabled",
    from: "PickFlick <pickflick@example.invalid>",
    deliveryMode: "disabled",
    deliveryEnabled: false,
  },
  contact: { deliveryTo: "contact@example.invalid", hashSecret: "synthetic-contact-secret-at-least-32" },
  auth: {
    baseUrl: "http://127.0.0.1:3000",
    secret: "synthetic-auth-secret-at-least-32-characters",
    appleSignInEnabled: true,
    appleClientId: "synthetic-apple-client-id",
    appleKeyId: "SYNTHKEY1",
    applePrivateKey: "local-synthetic-apple-private-key",
    appleTeamId: "SYNTHTEAM1",
    googleClientId: "synthetic-google-client-id",
    googleClientSecret: "synthetic-google-client-secret",
    secureCookies: false,
  },
} as const satisfies RuntimeEnvironment;

const auth = createIdentityAuth(environment, database, logger);

afterAll(async () => {
  await database.$disconnect();
});

describe("identity configuration", () => {
  it("keeps Apple unregistered and rejects direct Apple actions when the gate is disabled", async () => {
    const disabledAuth = createIdentityAuth(
      {
        ...environment,
        auth: { ...environment.auth, appleSignInEnabled: false },
      },
      database,
      logger,
    );
    const context = await disabledAuth.$context;
    expect(context.socialProviders.map(({ id }) => id)).toEqual(["google"]);
    expect(disabledAuth.options.account?.accountLinking?.trustedProviders).toEqual(["google"]);

    const before = disabledAuth.options.hooks?.before;
    await expect(before?.({
      body: { callbackURL: "/app", provider: "apple" },
      path: "/sign-in/social",
    } as never)).rejects.toMatchObject({ body: { code: "UNSUPPORTED_IDENTITY_PROVIDER" } });
    await expect(before?.({
      body: { callbackURL: "/app", provider: "apple" },
      path: "/link-social",
    } as never)).rejects.toMatchObject({ body: { code: "UNSUPPORTED_IDENTITY_LINK" } });
    await expect(before?.({
      body: { callbackURL: "/app", provider: "google" },
      path: "/sign-in/social",
    } as never)).resolves.toBeUndefined();
  });

  it("uses database-backed, encrypted OAuth state and database-only sessions", () => {
    expect(auth.options.account).toMatchObject({
      encryptOAuthTokens: true,
      updateAccountOnSignIn: false,
      storeAccountCookie: false,
      storeStateStrategy: "database",
      accountLinking: {
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        disableImplicitLinking: true,
        enabled: true,
        updateUserInfoOnLink: false,
      },
    });
    expect(auth.options.session).toMatchObject({
      cookieCache: { enabled: false },
      expiresIn: 604_800,
      freshAge: 900,
      updateAge: 86_400,
    });
    expect(auth.options.advanced?.cookies?.session_token).toMatchObject({
      name: "pickflick.session_token",
      attributes: { httpOnly: true, path: "/", sameSite: "lax", secure: false },
    });
    expect(auth.options.plugins?.[0]?.id).toBe("pickflick-oidc-providers");
    expect(auth.options.account?.accountLinking?.trustedProviders).toEqual(["apple", "google"]);
  });

  it("discards provider credentials because sign-in needs only the provider subject", async () => {
    const createHook = auth.options.databaseHooks?.account?.create?.before;
    const updateHook = auth.options.databaseHooks?.account?.update?.before;

    expect(await createHook?.({ providerId: "google" } as never, null)).toEqual({
      data: {
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
      },
    });
    expect(await updateHook?.({ providerId: "google" }, null)).toEqual({
      data: {
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
      },
    });
  });

  it("uses an exact host-only secure session cookie in deployed environments", async () => {
    const deployedAuth = createIdentityAuth(
      {
        ...environment,
        appEnvironment: "uat",
        auth: { ...environment.auth, baseUrl: "https://uat.pick-flick.app", secureCookies: true },
      },
      database,
      logger,
    );
    const context = await deployedAuth.$context;

    expect(context.authCookies.sessionToken).toMatchObject({
      name: "__Host-pickflick.session_token",
      attributes: { httpOnly: true, path: "/", sameSite: "lax", secure: true },
    });
    expect(context.authCookies.sessionToken.attributes).not.toHaveProperty("domain");
    expect(deployedAuth.options.advanced?.ipAddress).toEqual({
      ipAddressHeaders: ["cf-connecting-ip"],
    });
  });

  it("accepts only verified Google email for first-time profile bootstrap", async () => {
    const validate = auth.options.user?.validateUserInfo;
    expect(validate).toBeTypeOf("function");
    expect(
      await validate?.(
        {
          source: { action: "create-user", method: "oauth", oauth: { providerId: "google" } },
          user: { email: "person@example.invalid", emailVerified: false },
        },
      ),
    ).toEqual({ error: "google_email_not_verified" });
    expect(
      await validate?.(
        {
          source: { action: "create-user", method: "oauth", oauth: { providerId: "google" } },
          user: { email: "person@example.invalid", emailVerified: true },
        },
      ),
    ).toBeUndefined();
  });

  it("accepts only verified Apple email for first-time profile bootstrap", async () => {
    const validate = auth.options.user?.validateUserInfo;
    expect(
      await validate?.({
        source: { action: "create-user", method: "oauth", oauth: { providerId: "apple" } },
        user: { email: "relay@privaterelay.appleid.com", emailVerified: false },
      }),
    ).toEqual({ error: "apple_email_not_verified" });
    expect(
      await validate?.({
        source: { action: "create-user", method: "oauth", oauth: { providerId: "apple" } },
        user: { email: "relay@privaterelay.appleid.com", emailVerified: true },
      }),
    ).toBeUndefined();
  });
});
