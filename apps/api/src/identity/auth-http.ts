import type { IncomingMessage, ServerResponse } from "node:http";

type NodeAuthHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

const allowedAuthRequests = new Set([
  "GET /api/auth/callback/apple",
  "GET /api/auth/callback/google",
  "GET /api/auth/get-session",
  "GET /api/auth/list-accounts",
  "POST /api/auth/callback/apple",
  "POST /api/auth/callback/google",
  "POST /api/auth/link-social",
  "POST /api/auth/sign-in/social",
  "POST /api/auth/sign-out",
  "POST /api/auth/unlink-account",
]);

export function isAllowedAuthRequest(method: string | undefined, requestUrl: string | undefined): boolean {
  if (!method || !requestUrl) {
    return false;
  }

  const pathname = new URL(requestUrl, "http://pickflick.invalid").pathname;
  return allowedAuthRequests.has(`${method.toUpperCase()} ${pathname}`);
}

export function restrictAuthHandler(handler: NodeAuthHandler): NodeAuthHandler {
  return async (request, response) => {
    if (!isAllowedAuthRequest(request.method, request.url)) {
      response.statusCode = 404;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ statusCode: 404, message: "Not Found" }));
      return;
    }

    await handler(request, response);
  };
}
