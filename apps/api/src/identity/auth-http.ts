import type { IncomingMessage, ServerResponse } from "node:http";
import type { createDatabaseClient } from "@pickflick/database";

import { storeAppleCallbackProfile } from "./apple-callback-handoff.js";
import { sanitizeAppleCallbackProfile } from "./apple-profile.js";

type NodeAuthHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;
type AccountListHandler = (request: IncomingMessage) => Promise<Response>;

interface AuthHandlerOptions {
  readonly appleSignInEnabled: boolean;
  readonly database: ReturnType<typeof createDatabaseClient>;
  readonly listAccounts: AccountListHandler;
}

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

    if (request.method === "POST" && requestPath(request.url) === "/api/auth/callback/apple") {
      await handleAppleCallbackPost(request, response, options.database);
      return;
    }

    if (request.method === "GET" && requestPath(request.url) === "/api/auth/list-accounts") {
      await writeFilteredAccounts(response, await options.listAccounts(request));
      return;
    }

    await handler(request, response);
  };
}
