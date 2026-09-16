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
  it("uses database-backed, encrypted OAuth state and database-only sessions", () => {
    expect(auth.options.account).toMatchObject({
      encryptOAuthTokens: true,
      updateAccountOnSignIn: false,
      storeAccountCookie: false,
      storeStateStrategy: "database",
      accountLinking: { disableImplicitLinking: true, enabled: false },
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
    expect(auth.options.plugins?.[0]?.id).toBe("pickflick-google-oidc");
    expect(auth.options.account?.accountLinking?.trustedProviders).toEqual(["google"]);
  });

  it("discards provider credentials because Google sign-in needs only the provider subject", async () => {
    const createHook = auth.options.databaseHooks?.account?.create?.before;
    const updateHook = auth.options.databaseHooks?.account?.update?.before;

    expect(await createHook?.()).toEqual({
      data: {
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
      },
    });
    expect(await updateHook?.()).toEqual({
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
});
