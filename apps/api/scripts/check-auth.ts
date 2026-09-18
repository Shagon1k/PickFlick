import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { loadRuntimeEnvironment, type RuntimeEnvironment } from "@pickflick/config/environment";
import { assertSafeSeedOrResetTarget, createDatabaseClient } from "@pickflick/database";
import { createLogger } from "@pickflick/observability";
import type { BetterAuthPlugin } from "better-auth";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { testUtils } from "better-auth/plugins";

import { restrictAuthHandler } from "../src/identity/auth-http.js";
import { IdentityAuthorizationService } from "../src/identity/authorization.service.js";
import { normalizeAppleDisplayName } from "../src/identity/apple-profile.js";
import { identityUserLockKey } from "../src/identity/identity-lock.js";
import { createIdentityAuth } from "../src/identity/identity.service.js";

const configuredEnvironment = loadRuntimeEnvironment();
if (configuredEnvironment.appEnvironment !== "local" && configuredEnvironment.appEnvironment !== "test") {
  throw new Error("The authentication integration check may run only against local or test data.");
}
const environment: RuntimeEnvironment = {
  ...configuredEnvironment,
  auth: {
    ...configuredEnvironment.auth,
    appleSignInEnabled: true,
    appleClientId: "local-synthetic-apple-client-id",
    appleKeyId: "SYNTHKEY1",
    applePrivateKey: "local-synthetic-apple-private-key",
    appleTeamId: "SYNTHTEAM1",
  },
};
assertSafeSeedOrResetTarget(environment);

const database = createDatabaseClient(environment.databaseUrl);
const logger = createLogger({ environment: environment.appEnvironment, service: "api" });
const email = `auth-check-${randomUUID()}@example.invalid`;
const conflictEmail = `auth-check-conflict-${randomUUID()}@example.invalid`;
const appleEmail = `auth-check-${randomUUID()}@privaterelay.appleid.com`;
const appleLinkEmail = `auth-link-${randomUUID()}@privaterelay.appleid.com`;
const appleOwnedEmail = `auth-owned-${randomUUID()}@privaterelay.appleid.com`;
const authorizationCodeExchanges: string[] = [];
let syntheticClientSequence = Date.now() % 60_000;

function nextSyntheticClientAddress(): string {
  syntheticClientSequence = (syntheticClientSequence + 1) % 60_000;
  return `198.18.${Math.floor(syntheticClientSequence / 250)}.${syntheticClientSequence % 250 + 1}`;
}

function deterministicGoogleProvider() {
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

  return provider;
}

function deterministicAppleIdToken(profile: Readonly<Record<string, unknown>>): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: "synthetic" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(profile)).toString("base64url");
  return `${header}.${payload}.synthetic-signature`;
}

function deterministicAppleProfile(code: string) {
  if (code === "apple-conflict") {
    return { code, email: conflictEmail.toUpperCase(), email_verified: true, sub: "apple-conflict-subject" };
  }
  if (code === "apple-link") {
    return { code, email: appleLinkEmail, email_verified: "true", sub: "apple-linked-subject" };
  }
  if (code === "apple-owned") {
    return { code, email: appleOwnedEmail, email_verified: true, sub: "apple-owned-subject" };
  }
  if (code === "apple-unverified") {
    return { code, email: `unverified-${appleEmail}`, email_verified: false, sub: "apple-unverified-subject" };
  }
  if (code === "apple-returning") {
    return { code, email_verified: false, sub: "apple-auth-check-subject" };
  }
  return { code, email: appleEmail, email_verified: "true", sub: "apple-auth-check-subject" };
}

function deterministicAppleProvider() {
  const provider = {
    id: "apple",
    name: "Apple",
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
      const url = new URL("https://appleid.apple.com/auth/authorize");
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirectURI);
      url.searchParams.set("code_challenge", codeVerifier);
      url.searchParams.set("response_mode", "form_post");
      if (idTokenNonce) {
        url.searchParams.set("nonce", idTokenNonce);
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
        scopes: ["openid", "email", "name"],
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
      const payload = tokens.idToken.split(".")[1];
      const profile = payload
        ? JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ReturnType<typeof deterministicAppleProfile>
        : undefined;
      if (!profile) {
        return null;
      }
      const existingAccount = await database.providerAccount.findUnique({
        where: { provider_providerSubject: { provider: "apple", providerSubject: profile.sub } },
        select: { providerEmail: true, user: { select: { email: true } } },
      });
      const emailVerified = profile.email_verified === true || profile.email_verified === "true";
      const name = normalizeAppleDisplayName(
        [tokens.user?.name?.firstName, tokens.user?.name?.lastName].filter(Boolean).join(" "),
      ) ?? "";
      return {
        data: { ...profile, name },
        user: {
          email: profile.email ?? existingAccount?.providerEmail ?? existingAccount?.user.email,
          emailVerified: emailVerified || Boolean(existingAccount),
          name,
        },
      };
    },
  };

  return provider;
}

function deterministicProviders(): BetterAuthPlugin {
  return {
    id: "pickflick-deterministic-providers",
    init: () => ({
      context: {
        socialProviders: [deterministicGoogleProvider(), deterministicAppleProvider()],
      },
    }),
  };
}

const auth = createIdentityAuth(environment, database, logger, [testUtils()]);
const deterministicAuth = createIdentityAuth(environment, database, logger, [
  deterministicProviders(),
  testUtils(),
]);
const deterministicAuthorization = new IdentityAuthorizationService(
  database,
  logger,
  (headers) => deterministicAuth.api.getSession({
    headers: fromNodeHeaders(headers),
    query: { disableRefresh: true },
  }),
);
const deterministicHttpServer = createServer(restrictAuthHandler(toNodeHandler(deterministicAuth), {
  appleSignInEnabled: true,
  clientAddressHeader: "x-forwarded-for",
  database,
  listAccounts: (request) => deterministicAuth.api.listUserAccounts({
    asResponse: true,
    headers: fromNodeHeaders(request.headers),
  }),
  resolveSession: (request) => deterministicAuthorization.resolveSession(request.headers),
}));
await new Promise<void>((resolve, reject) => {
  deterministicHttpServer.once("error", reject);
  deterministicHttpServer.listen(0, "127.0.0.1", resolve);
});
const deterministicHttpAddress = deterministicHttpServer.address();
if (!deterministicHttpAddress || typeof deterministicHttpAddress === "string") {
  throw new Error("The deterministic authentication HTTP server did not expose a local port.");
}
const deterministicHttpBaseUrl = `http://127.0.0.1:${deterministicHttpAddress.port}`;
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
        "x-forwarded-for": nextSyntheticClientAddress(),
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

function mergeCookieHeaders(...headers: Array<string | null>): string {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const cookie of header?.split(/;\s*/) ?? []) {
      const separator = cookie.indexOf("=");
      if (separator > 0) {
        cookies.set(cookie.slice(0, separator), cookie);
      }
    }
  }
  return [...cookies.values()].join("; ");
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

async function startAppleSignIn(
  identityAuth = auth,
  options: {
    headers?: HeadersInit;
    link?: boolean;
    returnTo?: string;
  } = {},
): Promise<{ cookie: string; state: string; url: URL }> {
  const pathname = options.link ? "/api/auth/link-social" : "/api/auth/sign-in/social";
  const response = await identityAuth.handler(
    new Request(`${environment.auth.baseUrl}${pathname}`, {
      body: JSON.stringify({
        callbackURL: options.returnTo ?? "/app",
        disableRedirect: true,
        provider: "apple",
      }),
      headers: {
        "content-type": "application/json",
        origin: environment.auth.baseUrl,
        "x-forwarded-for": nextSyntheticClientAddress(),
        ...Object.fromEntries(new Headers(options.headers).entries()),
      },
      method: "POST",
    }),
  );
  const body = await response.json() as { url?: string };
  const url = body.url ? new URL(body.url) : undefined;
  const state = url?.searchParams.get("state") ?? undefined;
  const initiatingCookie = new Headers(options.headers).get("cookie");
  const responseCookie = response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  const cookie = mergeCookieHeaders(initiatingCookie, responseCookie);

  if (
    !response.ok ||
    url?.hostname !== "appleid.apple.com" ||
    !state ||
    !cookie ||
    !url.searchParams.has("nonce") ||
    !url.searchParams.has("code_challenge") ||
    url.searchParams.get("response_mode") !== "form_post"
  ) {
    throw new Error(
      `Apple authorization did not bind the browser attempt (status=${response.status}, host=${url?.hostname ?? "none"}, state=${Boolean(state)}, cookie=${Boolean(cookie)}, nonce=${Boolean(url?.searchParams.has("nonce"))}, pkce=${Boolean(url?.searchParams.has("code_challenge"))}, formPost=${url?.searchParams.get("response_mode") === "form_post"}).`,
    );
  }

  oauthStateIdentifiers.add(state);
  return { cookie, state, url };
}

async function submitAppleCallback(
  attempt: { cookie: string; state: string },
  code: string,
  user?: Readonly<Record<string, unknown>>,
): Promise<Response> {
  const postResponse = await postAppleCallback(attempt, code, user);
  const location = postResponse.headers.get("location");
  const redirect = location ? new URL(location, deterministicHttpBaseUrl) : undefined;
  if (
    postResponse.status !== 303 ||
    !redirect ||
    redirect.searchParams.get("code") !== code ||
    redirect.searchParams.get("state") !== attempt.state ||
    [...redirect.searchParams.keys()].some((key) => key !== "code" && key !== "state")
  ) {
    throw new Error("The Apple form POST did not use the profile-free server-side callback handoff.");
  }
  return fetch(redirect, {
    headers: { cookie: attempt.cookie },
    redirect: "manual",
  });
}

async function postAppleCallback(
  attempt: { cookie: string; state: string },
  code: string,
  user?: Readonly<Record<string, unknown>>,
  sourceAddress = nextSyntheticClientAddress(),
): Promise<Response> {
  const body = new URLSearchParams({ code, state: attempt.state });
  if (user) {
    body.set("user", JSON.stringify(user));
  }
  return fetch(`${deterministicHttpBaseUrl}/api/auth/callback/apple`, {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: attempt.cookie,
      "x-forwarded-for": sourceAddress,
    },
    method: "POST",
    redirect: "manual",
  });
}

async function completeAppleSignIn(code: string, user?: Readonly<Record<string, unknown>>) {
  const attempt = await startAppleSignIn(deterministicAuth);
  const response = await submitAppleCallback(attempt, code, user);
  return { response, sessionCookie: responseCookieHeader(response) };
}

async function waitForBlockedIdentityLock(lockKey: string, expectedWaiters: number): Promise<void> {
  const timeoutAt = Date.now() + 5_000;
  do {
    const rows = await database.$queryRaw<Array<{ waiting: bigint }>>`
      SELECT COUNT(*) AS waiting
      FROM pg_locks
      WHERE locktype = 'advisory'
        AND NOT granted
        AND classid::bigint = ((hashtextextended(${lockKey}, 0) >> 32) & 4294967295)
        AND objid::bigint = (hashtextextended(${lockKey}, 0) & 4294967295)
    `;
    if (Number(rows[0]?.waiting ?? 0) >= expectedWaiters) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < timeoutAt);
  throw new Error(`The identity lock did not serialize ${expectedWaiters} concurrent operations.`);
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
  const resolvedSession = await deterministicAuthorization.resolveSession(
    Object.fromEntries(login.headers.entries()),
  );
  if (!resolvedSession.authorized || resolvedSession.principal.appRole !== "USER") {
    throw new Error("The shared session resolver did not return current User authorization.");
  }
  const forgedSession = await deterministicAuthorization.resolveSession({
    cookie: "pickflick.session_token=forged-private-token",
  });
  if (forgedSession.authorized || forgedSession.reason !== "invalid_session") {
    throw new Error("The shared session resolver accepted a forged session.");
  }
  const forgedAccountProjection = await fetch(`${deterministicHttpBaseUrl}/api/auth/list-accounts`, {
    headers: { cookie: "pickflick.session_token=forged-private-token" },
  });
  if (forgedAccountProjection.status !== 401) {
    throw new Error("A forged session reached a protected authentication projection.");
  }
  const deniedRequestAddress = nextSyntheticClientAddress();
  const deniedProtectedResponses: Response[] = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    deniedProtectedResponses.push(await fetch(`${deterministicHttpBaseUrl}/api/auth/link-social`, {
      body: JSON.stringify({ callbackURL: "/app", provider: "google" }),
      headers: {
        "content-type": "application/json",
        cookie: "pickflick.session_token=forged-private-token",
        origin: environment.auth.baseUrl,
        "x-forwarded-for": deniedRequestAddress,
      },
      method: "POST",
    }));
  }
  if (
    deniedProtectedResponses.slice(0, 10).some(({ status }) => status !== 401) ||
    deniedProtectedResponses[10]?.status !== 429
  ) {
    throw new Error("Denied protected authentication requests did not consume the configured abuse limit.");
  }

  const expiredLogin = await helpers.login({ userId });
  await database.authSession.update({
    data: { expiresAt: new Date(Date.now() - 1_000) },
    where: { token: expiredLogin.token },
  });
  const expiredSession = await deterministicAuthorization.resolveSession(
    Object.fromEntries(expiredLogin.headers.entries()),
  );
  if (expiredSession.authorized || expiredSession.reason !== "invalid_session") {
    throw new Error("The shared session resolver accepted an expired session.");
  }

  const rollingLogin = await helpers.login({ userId });
  const preRefreshExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1_000);
  await database.authSession.update({
    data: { expiresAt: preRefreshExpiry },
    where: { token: rollingLogin.token },
  });
  const rollingResponse = await fetch(`${deterministicHttpBaseUrl}/api/auth/get-session`, {
    headers: rollingLogin.headers,
  });
  const rolledSession = await database.authSession.findUnique({ where: { token: rollingLogin.token } });
  if (
    !rollingResponse.ok ||
    !rollingResponse.headers.getSetCookie().some((cookie) => cookie.startsWith("pickflick.session_token=")) ||
    !rolledSession ||
    rolledSession.expiresAt <= preRefreshExpiry
  ) {
    throw new Error("The session boundary discarded a rolling session cookie update.");
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

  const afterRevocation = await fetch(`${deterministicHttpBaseUrl}/api/auth/get-session`, {
    headers: login.headers,
  });
  if (
    !afterRevocation.ok ||
    await afterRevocation.json() !== null ||
    !afterRevocation.headers.getSetCookie().some(
      (cookie) => cookie.startsWith("pickflick.session_token=") && /Max-Age=0/i.test(cookie),
    )
  ) {
    throw new Error("A revoked session remained usable or its browser cookie was not cleared.");
  }
  const revokedSession = await deterministicAuthorization.resolveSession(
    Object.fromEntries(login.headers.entries()),
  );
  if (revokedSession.authorized || revokedSession.reason !== "invalid_session") {
    throw new Error("The shared session resolver accepted a revoked session.");
  }

  const adminUserId = randomUUID();
  const suspendedUserId = randomUUID();
  const roleTargetUserId = randomUUID();
  userIds.add(adminUserId);
  userIds.add(suspendedUserId);
  userIds.add(roleTargetUserId);
  await database.user.createMany({
    data: [
      {
        appRole: "APP_ADMIN",
        displayName: "Auth Check Admin",
        email: `auth-admin-${randomUUID()}@example.invalid`,
        emailVerified: true,
        id: adminUserId,
      },
      {
        displayName: "Suspension Target",
        email: `auth-suspended-${randomUUID()}@example.invalid`,
        emailVerified: true,
        id: suspendedUserId,
      },
      {
        displayName: "Role Target",
        email: `auth-role-${randomUUID()}@example.invalid`,
        emailVerified: true,
        id: roleTargetUserId,
      },
    ],
  });
  const adminPrincipal = { appRole: "APP_ADMIN", sessionId: "integration-admin", userId: adminUserId } as const;
  const suspendedLogin = await helpers.login({ userId: suspendedUserId });
  await helpers.login({ userId: suspendedUserId });
  await deterministicAuthorization.suspendUser(adminPrincipal, suspendedUserId);
  const suspendedSession = await deterministicAuthorization.resolveSession(
    Object.fromEntries(suspendedLogin.headers.entries()),
  );
  if (
    suspendedSession.authorized ||
    suspendedSession.reason !== "invalid_session" ||
    await database.authSession.count({ where: { userId: suspendedUserId } }) !== 0 ||
    (await database.user.findUnique({ where: { id: suspendedUserId } }))?.status !== "SUSPENDED"
  ) {
    throw new Error("Suspension did not deny access and revoke every User session.");
  }
  const suspendedSessionProjection = await fetch(`${deterministicHttpBaseUrl}/api/auth/get-session`, {
    headers: suspendedLogin.headers,
  });
  if (suspendedSessionProjection.status !== 200 || await suspendedSessionProjection.json() !== null) {
    throw new Error("A suspended User received an authenticated session projection.");
  }

  const roleTargetLogin = await helpers.login({ userId: roleTargetUserId });
  await deterministicAuthorization.setAppRole(adminPrincipal, roleTargetUserId, "APP_ADMIN");
  if (
    await database.authSession.findUnique({ where: { token: roleTargetLogin.token } }) ||
    !await deterministicAuthorization.authorizeBackgroundUser(roleTargetUserId, ["APP_ADMIN"])
  ) {
    throw new Error("An App role change did not revoke sessions or update background authorization.");
  }
  const postRoleChangeLogin = await helpers.login({ userId: roleTargetUserId });
  await deterministicAuthorization.setAppRole(adminPrincipal, roleTargetUserId, "APP_ADMIN");
  if (!await database.authSession.findUnique({ where: { token: postRoleChangeLogin.token } })) {
    throw new Error("An unchanged App role retry revoked a newly issued session.");
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

  const googleLinkHeaders = new Headers({
    "content-type": "application/json",
    cookie: registered.sessionCookie,
    origin: environment.auth.baseUrl,
    "x-forwarded-for": nextSyntheticClientAddress(),
  });
  const googleLink = await auth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/link-social`, {
      body: JSON.stringify({
        callbackURL: "/app",
        disableRedirect: true,
        loginHint: "caller-controlled@example.invalid",
        provider: "google",
      }),
      headers: googleLinkHeaders,
      method: "POST",
    }),
  );
  const googleLinkBody = await googleLink.json() as { url?: string };
  const googleLinkUrl = googleLinkBody.url ? new URL(googleLinkBody.url) : undefined;
  const googleLinkState = googleLinkUrl?.searchParams.get("state");
  if (!googleLink.ok || !googleLinkState || googleLinkUrl.searchParams.has("login_hint")) {
    throw new Error("An explicit Google link retained a caller-controlled login hint.");
  }
  oauthStateIdentifiers.add(googleLinkState);

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

  const amplificationAttempt = await startAppleSignIn(deterministicAuth);
  const amplificationAddress = nextSyntheticClientAddress();
  const amplificationResponses: Response[] = [];
  for (let index = 0; index < 11; index += 1) {
    amplificationResponses.push(await postAppleCallback(
      amplificationAttempt,
      `amplification-${index}`,
      { name: { firstName: `Attempt ${index}` } },
      amplificationAddress,
    ));
  }
  if (
    amplificationResponses.slice(0, 10).some(({ status }) => status !== 303) ||
    amplificationResponses[10]?.status !== 429
  ) {
    throw new Error("The Apple callback POST boundary did not enforce its request limit.");
  }
  const amplificationHandoffs = await database.authVerification.findMany({
    where: { identifier: { startsWith: "apple-callback:" } },
  });
  if (amplificationHandoffs.length !== 1) {
    throw new Error("One pending Apple state created more than one callback handoff.");
  }
  await database.authVerification.update({
    data: { expiresAt: new Date(Date.now() - 1_000) },
    where: { id: amplificationHandoffs[0]!.id },
  });
  const cleanupAttempt = await startAppleSignIn(deterministicAuth);
  const cleanupPost = await postAppleCallback(
    cleanupAttempt,
    "cleanup-trigger",
    { name: { firstName: "Cleanup" } },
  );
  if (
    cleanupPost.status !== 303 ||
    await database.authVerification.findUnique({ where: { id: amplificationHandoffs[0]!.id } })
  ) {
    throw new Error("An expired Apple callback handoff was not removed.");
  }
  await database.authVerification.deleteMany({
    where: { identifier: { startsWith: "apple-callback:" } },
  });

  const appleDeniedAttempt = await startAppleSignIn(deterministicAuth);
  const appleDeniedUrl = new URL("/api/auth/callback/apple", environment.auth.baseUrl);
  appleDeniedUrl.searchParams.set("error", "access_denied");
  appleDeniedUrl.searchParams.set("error_description", "provider-secret-detail");
  appleDeniedUrl.searchParams.set("state", appleDeniedAttempt.state);
  const appleDenied = await deterministicAuth.handler(
    new Request(appleDeniedUrl, { headers: { cookie: appleDeniedAttempt.cookie } }),
  );
  assertSafeLoginFailure(appleDenied, "An Apple provider denial did not return a safe Login failure.");

  const unverifiedApple = await completeAppleSignIn("apple-unverified", {
    name: { firstName: "Unverified", lastName: "Apple" },
  });
  assertSafeLoginFailure(unverifiedApple.response, "An unverified new Apple email was accepted.");
  const unverifiedLocation = new URL(
    unverifiedApple.response.headers.get("location") ?? "",
    environment.auth.baseUrl,
  );
  if (unverifiedLocation.searchParams.get("error") !== "apple_email_not_verified") {
    throw new Error("An unverified Apple email did not return the stable provider error.");
  }

  const longAppleLastName = `First ${"Return ".repeat(50)}`;
  const expectedAppleDisplayName = normalizeAppleDisplayName(`Apple ${longAppleLastName}`);
  const registeredApple = await completeAppleSignIn("apple-new-user", {
    email: appleEmail,
    name: { firstName: "\u0000Apple\u200b", lastName: longAppleLastName },
  });
  if (registeredApple.response.status !== 302 || registeredApple.response.headers.get("location") !== "/app") {
    throw new Error("A new Apple User did not reach the validated application return target.");
  }
  const appleUser = await database.user.findUnique({ where: { email: appleEmail } });
  if (!appleUser || appleUser.displayName !== expectedAppleDisplayName || [...appleUser.displayName].length > 200) {
    throw new Error("Apple first-return profile fields did not safely bootstrap the new User.");
  }
  userIds.add(appleUser.id);
  const appleAccount = await database.providerAccount.findUnique({
    where: { provider_providerSubject: { provider: "apple", providerSubject: "apple-auth-check-subject" } },
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
    throw new Error("Apple identity persistence lost first-return fields or retained provider credentials.");
  }

  const returningApple = await completeAppleSignIn("apple-returning");
  if (returningApple.response.status !== 302 || returningApple.response.headers.get("location") !== "/app") {
    throw new Error("A known Apple subject could not sign in after Apple omitted later profile fields.");
  }
  const appleUserAfterReturn = await database.user.findUnique({ where: { id: appleUser.id } });
  if (appleUserAfterReturn?.displayName !== expectedAppleDisplayName || appleUserAfterReturn.email !== appleEmail) {
    throw new Error("A later Apple callback erased first-return profile fields or moved the identity by email.");
  }

  await deterministicAuthorization.suspendUser(adminPrincipal, appleUser.id);
  const suspendedAppleReturn = await completeAppleSignIn("apple-returning");
  assertSafeLoginFailure(
    suspendedAppleReturn.response,
    "A suspended User received a fresh session from a returning provider sign-in.",
  );
  if (await database.authSession.count({ where: { userId: appleUser.id } }) !== 0) {
    throw new Error("A returning provider sign-in persisted a session for a suspended User.");
  }

  const appleConflict = await completeAppleSignIn("apple-conflict", {
    name: { firstName: "Conflict", lastName: "Apple" },
  });
  assertSafeLoginFailure(appleConflict.response, "An email-conflicting Apple identity matched an existing User.");
  const appleConflictLocation = new URL(
    appleConflict.response.headers.get("location") ?? "",
    environment.auth.baseUrl,
  );
  if (appleConflictLocation.searchParams.get("error") !== "account_not_linked") {
    throw new Error("An Apple email conflict did not return the stable account-not-linked error.");
  }

  const staleLogin = await helpers.login({ userId: registeredUser.id });
  await database.authSession.update({
    where: { token: staleLogin.token },
    data: { createdAt: new Date(Date.now() - 16 * 60 * 1_000) },
  });
  const staleLinkHeaders = new Headers(staleLogin.headers);
  staleLinkHeaders.set("content-type", "application/json");
  staleLinkHeaders.set("origin", environment.auth.baseUrl);
  const staleLink = await deterministicAuth.handler(
    new Request(`${environment.auth.baseUrl}/api/auth/link-social`, {
      body: JSON.stringify({ callbackURL: "/app", disableRedirect: true, provider: "apple" }),
      headers: staleLinkHeaders,
      method: "POST",
    }),
  );
  const staleLinkBody = await staleLink.json() as { code?: string };
  if (staleLink.status !== 403 || staleLinkBody.code !== "SESSION_NOT_FRESH") {
    throw new Error("A stale session created an explicit identity-link intent.");
  }

  const revokedCallbackLogin = await helpers.login({ userId: registeredUser.id });
  const revokedLinkAttempt = await startAppleSignIn(deterministicAuth, {
    headers: revokedCallbackLogin.headers,
    link: true,
  });
  await database.authSession.delete({ where: { token: revokedCallbackLogin.token } });
  const revokedLink = await submitAppleCallback(revokedLinkAttempt, "apple-link");
  assertSafeLoginFailure(revokedLink, "A revoked initiating session completed an identity link.");
  if (await database.providerAccount.findUnique({
    where: { provider_providerSubject: { provider: "apple", providerSubject: "apple-linked-subject" } },
  })) {
    throw new Error("A revoked initiating session persisted an identity link.");
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
  const staleCallbackLink = await submitAppleCallback(staleCallbackAttempt, "apple-link");
  assertSafeLoginFailure(staleCallbackLink, "A session that became stale completed an identity link.");
  if (await database.providerAccount.findUnique({
    where: { provider_providerSubject: { provider: "apple", providerSubject: "apple-linked-subject" } },
  })) {
    throw new Error("A session that became stale persisted an identity link.");
  }

  const appleLinkAttempt = await startAppleSignIn(deterministicAuth, {
    headers: { cookie: registered.sessionCookie },
    link: true,
  });
  const linkedApple = await submitAppleCallback(appleLinkAttempt, "apple-link", {
    email: appleLinkEmail,
    name: { firstName: "Linked", lastName: "Apple" },
  });
  if (linkedApple.status !== 302 || linkedApple.headers.get("location") !== "/app") {
    throw new Error("A fresh explicit Apple link did not complete.");
  }
  const linkedAccount = await database.providerAccount.findUnique({
    where: { provider_providerSubject: { provider: "apple", providerSubject: "apple-linked-subject" } },
  });
  const googleUserAfterLink = await database.user.findUnique({ where: { id: registeredUser.id } });
  if (
    linkedAccount?.userId !== registeredUser.id ||
    linkedAccount.providerEmail !== appleLinkEmail ||
    linkedAccount.providerDisplayName !== "Linked Apple" ||
    googleUserAfterLink?.email !== email ||
    googleUserAfterLink.displayName !== registeredUser.displayName
  ) {
    throw new Error("Explicit Apple relay linking changed the User profile or lost provider-owned fields.");
  }

  const listedAccounts = await fetch(`${deterministicHttpBaseUrl}/api/auth/list-accounts`, {
    headers: { cookie: registered.sessionCookie },
  });
  const listedAccountBody = await listedAccounts.text();
  if (
    !listedAccounts.ok ||
    !listedAccountBody.includes('"provider":"apple"') ||
    /accountId|providerSubject|providerEmail|providerDisplayName|accessToken|refreshToken|idToken/.test(listedAccountBody)
  ) {
    throw new Error("Linked-account listing exposed provider profile or credential fields.");
  }

  const ownedUserId = randomUUID();
  userIds.add(ownedUserId);
  const ownedAccount = await database.providerAccount.create({
    data: {
      provider: "apple",
      providerEmail: appleOwnedEmail,
      providerSubject: "apple-owned-subject",
      user: {
        create: {
          id: ownedUserId,
          displayName: "Owned Apple User",
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
  const duplicateLink = await submitAppleCallback(duplicateLinkAttempt, "apple-owned");
  assertSafeLoginFailure(duplicateLink, "An Apple identity linked to another User was reassigned.");
  const duplicateLocation = new URL(duplicateLink.headers.get("location") ?? "", environment.auth.baseUrl);
  if (duplicateLocation.searchParams.get("error") !== "account_not_linked") {
    throw new Error("A duplicate Apple identity exposed an unsafe linking error.");
  }
  const ownedAccountAfterLink = await database.providerAccount.findUnique({ where: { id: ownedAccount.id } });
  if (ownedAccountAfterLink?.userId !== ownedUserId) {
    throw new Error("An Apple provider identity was reassigned to another User.");
  }

  const concurrentUnlink = (accountId: string) => fetch(
    `${deterministicHttpBaseUrl}/api/auth/unlink-account`,
    {
      body: JSON.stringify({ accountId }),
      headers: {
        "content-type": "application/json",
        cookie: registered.sessionCookie,
        origin: environment.auth.baseUrl,
        "x-forwarded-for": nextSyntheticClientAddress(),
      },
      method: "POST",
    },
  );
  const concurrentUnlinks = await Promise.all([
    concurrentUnlink(providerAccount.id),
    concurrentUnlink(linkedAccount.id),
  ]);
  const remainingLinkedAccounts = await database.providerAccount.count({
    where: { userId: registeredUser.id },
  });
  if (concurrentUnlinks.filter(({ ok }) => ok).length !== 1 || remainingLinkedAccounts !== 1) {
    throw new Error("Concurrent unlink requests removed every supported provider identity.");
  }

  const ownedLogin = await helpers.login({ userId: ownedUserId });
  const unlinkHeaders = new Headers(ownedLogin.headers);
  unlinkHeaders.set("content-type", "application/json");
  unlinkHeaders.set("origin", environment.auth.baseUrl);
  unlinkHeaders.set("x-forwarded-for", nextSyntheticClientAddress());
  const unlinkLast = await fetch(`${deterministicHttpBaseUrl}/api/auth/unlink-account`, {
    body: JSON.stringify({ accountId: ownedAccount.id }),
    headers: unlinkHeaders,
    method: "POST",
  });
  if (unlinkLast.ok || !await database.providerAccount.findUnique({ where: { id: ownedAccount.id } })) {
    throw new Error("A User was allowed to unlink their last supported provider identity.");
  }

  const identityLockBlocker = createDatabaseClient(environment.databaseUrl);
  const lockKey = identityUserLockKey(registeredUser.id);
  let releaseIdentityLock: (() => void) | undefined;
  let signalIdentityLockHeld: (() => void) | undefined;
  const identityLockHeld = new Promise<void>((resolve) => {
    signalIdentityLockHeld = resolve;
  });
  const holdIdentityLock = new Promise<void>((resolve) => {
    releaseIdentityLock = resolve;
  });
  const blockingTransaction = identityLockBlocker.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    signalIdentityLockHeld?.();
    await holdIdentityLock;
  }, { timeout: 30_000 });
  try {
    await identityLockHeld;
    const sessionIssuance = helpers.login({ userId: registeredUser.id });
    await waitForBlockedIdentityLock(lockKey, 1);
    const suspension = deterministicAuthorization.suspendUser(adminPrincipal, registeredUser.id);
    await waitForBlockedIdentityLock(lockKey, 2);
    releaseIdentityLock?.();

    const issuedSession = await sessionIssuance;
    await suspension;
    await blockingTransaction;
    if (
      await database.authSession.count({ where: { userId: registeredUser.id } }) !== 0 ||
      (await database.user.findUnique({ where: { id: registeredUser.id } }))?.status !== "SUSPENDED"
    ) {
      throw new Error("Concurrent session issuance and suspension left an active session or incorrect User status.");
    }

    await database.user.update({ data: { status: "ACTIVE" }, where: { id: registeredUser.id } });
    const revokedConcurrentSession = await deterministicAuth.handler(
      new Request(`${environment.auth.baseUrl}/api/auth/get-session`, { headers: issuedSession.headers }),
    );
    if (!revokedConcurrentSession.ok || await revokedConcurrentSession.json() !== null) {
      throw new Error("A session revoked by concurrent suspension became valid after reinstatement.");
    }
  } finally {
    releaseIdentityLock?.();
    await blockingTransaction.catch(() => undefined);
    await identityLockBlocker.$disconnect();
  }

  console.log(
    "Authentication checks passed: new/returning Google and Apple identity, rate-limited single-row Apple POST handoff with expiry cleanup, pre-resolution protected-auth abuse limits, bounded first-return and relay fields, filtered account listings, fixed provider permissions and link parameters, callback-bound fresh-session linking, duplicate/conflict denial, serialized last-provider protection, no provider credential retention, origin/return rejection, state/nonce/PKCE, atomic state consumption, expiry/replay/denial intent safety, authoritative role/status resolution, rolling session cookies, forged/expired/revoked/suspended denial, suspended provider sign-in rejection, serialized concurrent session issuance and suspension, idempotent App role changes, transactional suspension and role-change revocation, database sessions, sign-out, and immediate revocation.",
  );
} finally {
  await new Promise<void>((resolve, reject) => {
    deterministicHttpServer.close((error) => error ? reject(error) : resolve());
  });
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
