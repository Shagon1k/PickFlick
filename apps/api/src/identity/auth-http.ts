import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { createDatabaseClient } from "@pickflick/database";

import { storeAppleCallbackProfile } from "./apple-callback-handoff.js";
import { sanitizeAppleCallbackProfile } from "./apple-profile.js";
import type { IdentitySessionResolution } from "./authorization.types.js";

type NodeAuthHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;
type AccountListHandler = (request: IncomingMessage) => Promise<Response>;

interface AuthHandlerOptions {
  readonly appleSignInEnabled: boolean;
  readonly clientAddressHeader: "cf-connecting-ip" | "x-forwarded-for";
  readonly database: ReturnType<typeof createDatabaseClient>;
  readonly listAccounts: AccountListHandler;
  readonly resolveSession: (request: IncomingMessage) => Promise<IdentitySessionResolution>;
}

const appleCallbackRateLimit = { maximum: 10, windowMilliseconds: 60_000 } as const;

const allowedAuthRequests = new Set([
  "GET /api/auth/callback/google",
  "GET /api/auth/get-session",
  "GET /api/auth/list-accounts",
  "POST /api/auth/callback/google",
  "POST /api/auth/link-social",
  "POST /api/auth/sign-in/social",
  "POST /api/auth/sign-out",
  "POST /api/auth/unlink-account",
]);

const appleCallbackRequests = new Set([
  "GET /api/auth/callback/apple",
  "POST /api/auth/callback/apple",
]);

const protectedAuthRequests = new Set([
  "GET /api/auth/list-accounts",
  "POST /api/auth/link-social",
  "POST /api/auth/unlink-account",
]);

export function isAllowedAuthRequest(
  method: string | undefined,
  requestUrl: string | undefined,
  appleSignInEnabled = false,
): boolean {
  if (!method || !requestUrl) {
    return false;
  }

  const pathname = new URL(requestUrl, "http://pickflick.invalid").pathname;
  const requestKey = `${method.toUpperCase()} ${pathname}`;
  return allowedAuthRequests.has(requestKey) || (appleSignInEnabled && appleCallbackRequests.has(requestKey));
}

function requestPath(requestUrl: string | undefined): string | undefined {
  return requestUrl ? new URL(requestUrl, "http://pickflick.invalid").pathname : undefined;
}

async function readFormBody(request: IncomingMessage): Promise<URLSearchParams | undefined> {
  const parsedBody = (request as IncomingMessage & { body?: unknown }).body;
  if (parsedBody && typeof parsedBody === "object" && !Buffer.isBuffer(parsedBody)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(parsedBody)) {
      if (typeof value === "string") {
        params.set(key, value);
      }
    }
    return params;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 100 * 1024) {
      return undefined;
    }
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function clientAddress(request: IncomingMessage, headerName: AuthHandlerOptions["clientAddressHeader"]): string {
  const header = request.headers[headerName];
  const value = Array.isArray(header) ? header[0] : header?.split(",", 1)[0];
  return value?.trim() || request.socket.remoteAddress || "unknown";
}

async function consumeAppleCallbackRateLimit(
  request: IncomingMessage,
  options: AuthHandlerOptions,
): Promise<number | undefined> {
  const addressHash = createHash("sha256")
    .update(clientAddress(request, options.clientAddressHeader))
    .digest("hex");
  const key = `apple-callback-post:${addressHash}`;

  return options.database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const now = Date.now();
    const existing = await transaction.authRateLimit.findUnique({ where: { key } });
    if (!existing) {
      await transaction.authRateLimit.create({ data: { count: 1, key, lastRequest: now } });
      return undefined;
    }

    const windowStartedAt = Number(existing.lastRequest);
    if (now - windowStartedAt >= appleCallbackRateLimit.windowMilliseconds) {
      await transaction.authRateLimit.update({
        data: { count: 1, lastRequest: now },
        where: { key },
      });
      return undefined;
    }
    if (existing.count >= appleCallbackRateLimit.maximum) {
      return Math.max(1, Math.ceil(
        (windowStartedAt + appleCallbackRateLimit.windowMilliseconds - now) / 1_000,
      ));
    }

    await transaction.authRateLimit.update({
      data: { count: { increment: 1 } },
      where: { key },
    });
    return undefined;
  });
}

async function authenticatedUserId(
  request: IncomingMessage,
  options: AuthHandlerOptions,
): Promise<string | undefined> {
  const upstream = await options.listAccounts(request);
  if (!upstream.ok) {
    return undefined;
  }
  const body = await upstream.json() as unknown;
  const accountIds = Array.isArray(body)
    ? body.flatMap((account) => {
        if (!account || typeof account !== "object") {
          return [];
        }
        const id = (account as { id?: unknown }).id;
        return typeof id === "string" ? [id] : [];
      })
    : [];
  if (accountIds.length === 0) {
    return undefined;
  }

  return (await options.database.providerAccount.findFirst({
    where: { id: { in: accountIds } },
    select: { userId: true },
  }))?.userId;
}

async function handleSerializedUnlink(
  request: IncomingMessage,
  response: ServerResponse,
  handler: NodeAuthHandler,
  options: AuthHandlerOptions,
): Promise<void> {
  const userId = await authenticatedUserId(request, options);
  if (!userId) {
    await handler(request, response);
    return;
  }

  const lockKey = `identity-unlink:${userId}`;
  await options.database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    await handler(request, response);
  });
}

async function handleAppleCallbackPost(
  request: IncomingMessage,
  response: ServerResponse,
  database: ReturnType<typeof createDatabaseClient>,
): Promise<void> {
  const body = await readFormBody(request);
  const code = body?.get("code");
  const state = body?.get("state");
  const error = body?.get("error");
  if (!state || (!code && !error) || state.length > 512 || (code?.length ?? 0) > 4096) {
    writeJson(response, 400, { statusCode: 400, message: "Invalid Apple callback." });
    return;
  }

  const callback = new URL("/api/auth/callback/apple", "http://pickflick.invalid");
  if (code) {
    callback.searchParams.set("code", code);
    const profile = sanitizeAppleCallbackProfile(body?.get("user"));
    if (profile) {
      await storeAppleCallbackProfile(database, state, code, profile);
    }
  } else if (error) {
    callback.searchParams.set("error", error);
  }
  callback.searchParams.set("state", state);

  response.statusCode = 303;
  response.setHeader("cache-control", "no-store");
  response.setHeader("location", `${callback.pathname}${callback.search}`);
  response.end();
}

async function writeFilteredAccounts(response: ServerResponse, upstream: Response): Promise<void> {
  if (!upstream.ok) {
    response.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => response.setHeader(key, value));
    response.end(Buffer.from(await upstream.arrayBuffer()));
    return;
  }

  const body = await upstream.json() as unknown;
  const accounts = Array.isArray(body)
    ? body.flatMap((account) => {
        if (!account || typeof account !== "object") {
          return [];
        }
        const { id, providerId } = account as { id?: unknown; providerId?: unknown };
        return typeof id === "string" && typeof providerId === "string"
          ? [{ id, provider: providerId }]
          : [];
      })
    : [];
  writeJson(response, upstream.status, accounts);
}

export function restrictAuthHandler(handler: NodeAuthHandler, options: AuthHandlerOptions): NodeAuthHandler {
  return async (request, response) => {
    if (!isAllowedAuthRequest(request.method, request.url, options.appleSignInEnabled)) {
      writeJson(response, 404, { statusCode: 404, message: "Not Found" });
      return;
    }

    const path = requestPath(request.url);
    const requestKey = `${request.method?.toUpperCase()} ${path}`;
    if (request.method === "GET" && path === "/api/auth/get-session") {
      const resolution = await options.resolveSession(request);
      if (!resolution.authorized && resolution.reason === "service_unavailable") {
        writeJson(response, 503, null);
        return;
      }
    } else if (protectedAuthRequests.has(requestKey)) {
      const resolution = await options.resolveSession(request);
      if (!resolution.authorized) {
        writeJson(
          response,
          resolution.reason === "service_unavailable" ? 503 : 401,
          { statusCode: resolution.reason === "service_unavailable" ? 503 : 401, message: "Unauthorized" },
        );
        return;
      }
    }

    if (request.method === "POST" && path === "/api/auth/callback/apple") {
      const retryAfter = await consumeAppleCallbackRateLimit(request, options);
      if (retryAfter) {
        response.setHeader("retry-after", String(retryAfter));
        writeJson(response, 429, { statusCode: 429, message: "Too many requests." });
        return;
      }
      await handleAppleCallbackPost(request, response, options.database);
      return;
    }

    if (request.method === "GET" && path === "/api/auth/list-accounts") {
      await writeFilteredAccounts(response, await options.listAccounts(request));
      return;
    }

    if (request.method === "POST" && path === "/api/auth/unlink-account") {
      await handleSerializedUnlink(request, response, handler, options);
      return;
    }

    await handler(request, response);
  };
}
