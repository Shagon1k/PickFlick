import { randomUUID } from "node:crypto";

import { loadRuntimeEnvironment } from "@pickflick/config/environment";
import { assertSafeSeedOrResetTarget, createDatabaseClient } from "@pickflick/database";
import { createLogger } from "@pickflick/observability";
import type { BetterAuthPlugin } from "better-auth";
import { testUtils } from "better-auth/plugins";

import { createIdentityAuth } from "../src/identity/identity.service.js";

const environment = loadRuntimeEnvironment();
if (environment.appEnvironment !== "local" && environment.appEnvironment !== "test") {
  throw new Error("The authentication integration check may run only against local or test data.");
}
assertSafeSeedOrResetTarget(environment);

const database = createDatabaseClient(environment.databaseUrl);
const logger = createLogger({ environment: environment.appEnvironment, service: "api" });
const email = `auth-check-${randomUUID()}@example.invalid`;
const conflictEmail = `auth-check-conflict-${randomUUID()}@example.invalid`;
const authorizationCodeExchanges: string[] = [];

function deterministicGoogleProvider(): BetterAuthPlugin {
  const provider = {
    id: "google",
    name: "Google",
    requiresIdTokenNonce: true,
    accountSubject: ({ profile }: { profile: { sub?: string } }) => profile.sub ?? "",
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
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirectURI);
      url.searchParams.set("code_challenge", codeVerifier);
      if (idTokenNonce) {
        url.searchParams.set("nonce", idTokenNonce);
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
        scopes: ["openid", "email", "profile"],
      };
    },
    async getUserInfo(tokens: { expectedIdTokenNonce?: string; idToken?: string }) {
      if (!tokens.expectedIdTokenNonce || !tokens.idToken) {
        return null;
      }
      const returning = tokens.idToken === "returning-user";
      const conflict = tokens.idToken === "email-conflict";
      const user = {
        sub: conflict ? "google-conflict-subject" : "google-auth-check-subject",
        email: conflict ? conflictEmail.toUpperCase() : returning ? `changed-${email}` : email,
        email_verified: !returning,
        name: "Auth Check User",
        picture: "https://images.example.invalid/auth-check.png",
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

  return {
    id: "pickflick-deterministic-google",
    init: () => ({ context: { socialProviders: [provider] } }),
  };
}

const auth = createIdentityAuth(environment, database, logger, [testUtils()]);
const deterministicAuth = createIdentityAuth(environment, database, logger, [
  deterministicGoogleProvider(),
  testUtils(),
]);
const existingRateLimitIds = new Set(
  (await database.authRateLimit.findMany({ select: { id: true } })).map(({ id }) => id),
);
const userIds = new Set<string>();
const oauthStateIdentifiers = new Set<string>();

async function startGoogleSignIn(
  identityAuth = auth,
  options: {
    additionalBody?: Readonly<Record<string, unknown>>;
    forwardedHeaders?: Readonly<Record<string, string>>;
    returnTo?: string;
  } = {},
): Promise<{ cookie: string; state: string; url: URL }> {
  const response = await identityAuth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/sign-in/social`, {
      body: JSON.stringify({
        callbackURL: options.returnTo ?? "/app",
        disableRedirect: true,
        provider: "google",
        ...options.additionalBody,
      }),
      headers: {
        "content-type": "application/json",
        origin: environment.auth.baseUrl,
        ...options.forwardedHeaders,
      },
      method: "POST",
    }),
  );
  const body = await response.json() as { url?: string };
  const url = body.url ? new URL(body.url) : undefined;
  const state = url?.searchParams.get("state") ?? undefined;
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];

  if (
    !response.ok ||
    url?.hostname !== "accounts.google.com" ||
    !state ||
    !cookie ||
    !url.searchParams.has("nonce") ||
    !url.searchParams.has("code_challenge")
  ) {
    throw new Error("Google authorization did not bind state, nonce, PKCE, and the browser attempt.");
  }

  oauthStateIdentifiers.add(state);
  return { cookie, state, url };
}

function assertSafeLoginFailure(response: Response, message: string): void {
  const location = response.headers.get("location");
  const redirect = location ? new URL(location, environment.auth.baseUrl) : undefined;
  if (
    response.ok ||
    !redirect ||
    redirect.pathname !== "/login" ||
    redirect.searchParams.has("error_description")
  ) {
    throw new Error(message);
  }
}

function responseCookieHeader(response: Response): string {
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

async function completeGoogleSignIn(code: string) {
  const attempt = await startGoogleSignIn(deterministicAuth);
  const response = await submitGoogleCallback(attempt, code);
  return { response, sessionCookie: responseCookieHeader(response) };
}

async function submitGoogleCallback(
  attempt: { cookie: string; state: string },
  code: string,
): Promise<Response> {
  const callbackUrl = new URL("/api/auth/callback/google", environment.auth.baseUrl);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", attempt.state);
  return deterministicAuth.handler(
    new Request(callbackUrl, { headers: { cookie: attempt.cookie } }),
  );
}

try {
  const context = await auth.$context;
  const helpers = (context as typeof context & {
    test: {
      login(input: { userId: string }): Promise<{
        cookies: Array<{ httpOnly?: boolean; name: string; sameSite?: string; secure?: boolean }>;
        headers: Headers;
        token: string;
      }>;
    };
  }).test;
  const userId = randomUUID();
  userIds.add(userId);
  await database.user.create({
    data: { id: userId, displayName: "Auth Check User", email, emailVerified: true },
  });
  const login = await helpers.login({ userId });
  const sessionCookie = login.cookies.find(({ name }) => name === "pickflick.session_token");
  if (!sessionCookie?.httpOnly || sessionCookie.sameSite !== "Lax" || sessionCookie.secure) {
    throw new Error("The local session cookie does not match the reviewed opaque-cookie contract.");
  }

  const storedSession = await database.authSession.findUnique({ where: { token: login.token } });
  if (!storedSession) {
    throw new Error("The deterministic login did not create a database session.");
  }

  const authenticated = await auth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/get-session`, { headers: login.headers }),
  );
  const authenticatedBody = await authenticated.json() as { user?: { id?: string } } | null;
  if (!authenticated.ok || authenticatedBody?.user?.id !== userId) {
    throw new Error("The database session did not resolve to its User.");
  }

  const signOutHeaders = new Headers(login.headers);
  signOutHeaders.set("content-type", "application/json");
  signOutHeaders.set("origin", environment.auth.baseUrl);
  const signedOut = await auth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/sign-out`, {
      body: "{}",
      headers: signOutHeaders,
      method: "POST",
    }),
  );
  if (!signedOut.ok || await database.authSession.findUnique({ where: { token: login.token } })) {
    throw new Error("Sign-out did not revoke the current database session immediately.");
  }

  const afterRevocation = await auth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/get-session`, { headers: login.headers }),
  );
  if (!afterRevocation.ok || await afterRevocation.json() !== null) {
    throw new Error("A revoked session remained usable.");
  }

  const crossOriginStart = await auth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/sign-in/social`, {
      body: JSON.stringify({ callbackURL: "/app", provider: "google" }),
      headers: {
        "content-type": "application/json",
        cookie: "pickflick.session_token=forged",
        origin: "https://untrusted.example.invalid",
      },
      method: "POST",
    }),
  );
  if (crossOriginStart.ok) {
    throw new Error("A credentialed cross-origin authentication request was accepted.");
  }

  const unsafeReturnStart = await auth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/sign-in/social`, {
      body: JSON.stringify({ callbackURL: "https://untrusted.example.invalid/steal", provider: "google" }),
      headers: { "content-type": "application/json", origin: environment.auth.baseUrl },
      method: "POST",
    }),
  );
  if (unsafeReturnStart.ok) {
    throw new Error("An unsafe authentication return target was accepted.");
  }

  const restrictedAttempt = await startGoogleSignIn(auth, {
    additionalBody: {
      additionalParams: { access_type: "offline", prompt: "consent" },
      scopes: ["https://www.googleapis.com/auth/drive"],
    },
  });
  if (
    restrictedAttempt.url.searchParams.get("scope") !== "openid email profile" ||
    restrictedAttempt.url.searchParams.get("access_type") !== "online" ||
    restrictedAttempt.url.searchParams.has("prompt")
  ) {
    throw new Error("Caller-controlled Google permissions or authorization parameters reached the provider URL.");
  }

  const deployedAuth = createIdentityAuth(
    {
      ...environment,
      appEnvironment: "uat",
      auth: { ...environment.auth, secureCookies: true },
    },
    database,
    logger,
  );
  const forwardedChain = "203.0.113.42, 198.51.100.8";
  for (const clientAddress of ["192.0.2.21", "192.0.2.22"]) {
    await startGoogleSignIn(deployedAuth, {
      forwardedHeaders: {
        "cf-connecting-ip": clientAddress,
        "x-forwarded-for": forwardedChain,
      },
    });
  }
  const productionRateLimitKeys = await database.authRateLimit.findMany({
    where: { key: { in: ["192.0.2.21|/sign-in/social", "192.0.2.22|/sign-in/social"] } },
  });
  if (productionRateLimitKeys.length !== 2) {
    throw new Error("Production-shaped forwarded requests did not retain distinct Cloudflare client identities.");
  }

  const expiringAttempt = await startGoogleSignIn();
  await database.authVerification.updateMany({
    data: { expiresAt: new Date(Date.now() - 1_000) },
    where: { identifier: expiringAttempt.state },
  });
  const expiredCallbackUrl = new URL("/api/auth/callback/google", environment.auth.baseUrl);
  expiredCallbackUrl.searchParams.set("code", "synthetic");
  expiredCallbackUrl.searchParams.set("state", expiringAttempt.state);
  const expiredCallback = await auth.handler(
    new Request(expiredCallbackUrl, { headers: { cookie: expiringAttempt.cookie } }),
  );
  assertSafeLoginFailure(expiredCallback, "An expired OAuth state did not fail safely.");

  const replayedCallback = await auth.handler(
    new Request(expiredCallbackUrl, { headers: { cookie: expiringAttempt.cookie } }),
  );
  assertSafeLoginFailure(replayedCallback, "A replayed OAuth state did not fail safely.");

  const invitationReturnTarget = "/invite/club/review-round-token";
  const deniedAttempt = await startGoogleSignIn(auth, { returnTo: invitationReturnTarget });
  const deniedCallbackUrl = new URL("/api/auth/callback/google", environment.auth.baseUrl);
  deniedCallbackUrl.searchParams.set("error", "access_denied");
  deniedCallbackUrl.searchParams.set("error_description", "provider-secret-detail");
  deniedCallbackUrl.searchParams.set("state", deniedAttempt.state);
  const deniedCallback = await auth.handler(
    new Request(deniedCallbackUrl, { headers: { cookie: deniedAttempt.cookie } }),
  );
  assertSafeLoginFailure(deniedCallback, "A provider denial did not return a safe Login failure.");
  const deniedRedirect = new URL(deniedCallback.headers.get("location") ?? "", environment.auth.baseUrl);
  if (deniedRedirect.searchParams.get("returnTo") !== invitationReturnTarget) {
    throw new Error("A provider denial discarded the validated invitation return target.");
  }

  const forgedCallback = await auth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/callback/google?code=synthetic&state=forged`),
  );
  assertSafeLoginFailure(forgedCallback, "A forged OAuth callback did not fail safely.");

  await database.user.delete({ where: { id: userId } });
  userIds.delete(userId);

  const registered = await completeGoogleSignIn("new-user");
  if (registered.response.status !== 302 || registered.response.headers.get("location") !== "/app") {
    throw new Error("A new Google User did not reach the validated application return target.");
  }
  const registeredUser = await database.user.findUnique({ where: { email } });
  if (!registeredUser) {
    throw new Error("The deterministic Google callback did not create a User.");
  }
  userIds.add(registeredUser.id);
  const providerAccount = await database.providerAccount.findUnique({
    where: {
      provider_providerSubject: {
        provider: "google",
        providerSubject: "google-auth-check-subject",
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
    throw new Error("Google identity persistence retained provider credentials or lost the provider subject binding.");
  }
  const registeredSession = await deterministicAuth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/get-session`, {
      headers: { cookie: registered.sessionCookie },
    }),
  );
  const registeredSessionBody = await registeredSession.json() as { user?: { id?: string } } | null;
  if (registeredSessionBody?.user?.id !== registeredUser.id) {
    throw new Error("A new Google User did not receive a resolvable database session.");
  }

  const returning = await completeGoogleSignIn("returning-user");
  if (returning.response.status !== 302 || returning.response.headers.get("location") !== "/app") {
    throw new Error("A returning Google User did not reach the validated application return target.");
  }
  const usersAfterReturn = await database.user.findMany({
    where: { providerAccounts: { some: { provider: "google", providerSubject: "google-auth-check-subject" } } },
  });
  if (
    usersAfterReturn.length !== 1 ||
    usersAfterReturn[0]?.id !== registeredUser.id ||
    usersAfterReturn[0]?.email !== email
  ) {
    throw new Error("A returning Google subject did not resolve to exactly one existing User.");
  }

  const concurrentAttempt = await startGoogleSignIn(deterministicAuth);
  const sessionsBeforeConcurrentCallbacks = await database.authSession.count({
    where: { userId: registeredUser.id },
  });
  const exchangesBeforeConcurrentCallbacks = authorizationCodeExchanges.length;
  const concurrentResponses = await Promise.all([
    submitGoogleCallback(concurrentAttempt, "concurrent-one"),
    submitGoogleCallback(concurrentAttempt, "concurrent-two"),
  ]);
  const successfulConcurrentResponses = concurrentResponses.filter(
    (response) => response.status === 302 && response.headers.get("location") === "/app",
  );
  const rejectedConcurrentResponses = concurrentResponses.filter(
    (response) => !successfulConcurrentResponses.includes(response),
  );
  if (successfulConcurrentResponses.length !== 1 || rejectedConcurrentResponses.length !== 1) {
    throw new Error("Concurrent callbacks did not enforce one successful use of the OAuth state.");
  }
  assertSafeLoginFailure(rejectedConcurrentResponses[0]!, "A concurrent OAuth-state replay did not fail safely.");
  if (authorizationCodeExchanges.length - exchangesBeforeConcurrentCallbacks !== 1) {
    throw new Error("A concurrent OAuth-state replay reached the provider code exchange.");
  }
  const sessionsAfterConcurrentCallbacks = await database.authSession.count({
    where: { userId: registeredUser.id },
  });
  if (sessionsAfterConcurrentCallbacks !== sessionsBeforeConcurrentCallbacks + 1) {
    throw new Error("Concurrent callbacks issued more than one database session from one OAuth state.");
  }

  const conflictingUserId = randomUUID();
  userIds.add(conflictingUserId);
  await database.user.create({
    data: { id: conflictingUserId, displayName: "Conflict User", email: conflictEmail, emailVerified: true },
  });
  const conflict = await completeGoogleSignIn("email-conflict");
  assertSafeLoginFailure(conflict.response, "A case-insensitive unlinked Google identity matched an existing email unsafely.");
  const conflictLocation = new URL(conflict.response.headers.get("location") ?? "", environment.auth.baseUrl);
  if (conflictLocation.searchParams.get("error") !== "account_not_linked") {
    throw new Error("An email conflict did not return the stable account-not-linked error.");
  }
  if (
    await database.providerAccount.findUnique({
      where: {
        provider_providerSubject: {
          provider: "google",
          providerSubject: "google-conflict-subject",
        },
      },
    })
  ) {
    throw new Error("An email-conflicting Google identity was persisted despite linking being disabled.");
  }

  console.log(
    "Authentication checks passed: new/returning Google identity, fixed Google permissions, proxy client separation, no provider credential retention, conflict denial, origin/return rejection, state/nonce/PKCE, atomic state consumption, expiry/replay/denial intent safety, database sessions, sign-out, and immediate revocation.",
  );
} finally {
  if (userIds.size > 0) {
    await database.user.deleteMany({ where: { id: { in: [...userIds] } } });
  }
  if (oauthStateIdentifiers.size > 0) {
    await database.authVerification.deleteMany({
      where: { identifier: { in: [...oauthStateIdentifiers] } },
    });
  }
  const createdRateLimitIds = (await database.authRateLimit.findMany({ select: { id: true } }))
    .map(({ id }) => id)
    .filter((id) => !existingRateLimitIds.has(id));
  if (createdRateLimitIds.length > 0) {
    await database.authRateLimit.deleteMany({ where: { id: { in: createdRateLimitIds } } });
  }
  await database.$disconnect();
}
