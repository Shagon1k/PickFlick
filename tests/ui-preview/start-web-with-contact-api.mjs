import { spawn } from "node:child_process";
import { createServer } from "node:http";

const retryKeys = new Map();
const clubsBySession = new Map();

function sessionToken(request) {
  return request.headers.cookie?.match(/(?:^|;\s*)pickflick\.session_token=([^;]+)/)?.[1];
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const api = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/auth/get-session") {
    const token = sessionToken(request);
    const authenticated = token?.startsWith("valid") ?? false;
    sendJson(response, 200, authenticated ? { user: { id: `user-${token}` } } : null);
    return;
  }
  if (request.url === "/clubs") {
    const token = sessionToken(request);
    if (!token?.startsWith("valid")) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "Authentication required.", requestId: "request-club-auth" } });
      return;
    }
    if (request.method === "GET") {
      sendJson(response, 200, { clubs: clubsBySession.get(token) ?? [] });
      return;
    }
    if (request.method === "POST") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        if ((clubsBySession.get(token) ?? []).length > 0) {
          sendJson(response, 409, { error: { code: "CONFLICT", message: "Conflict.", requestId: "request-club-limit" } });
          return;
        }
        const payload = JSON.parse(body);
        const description = String(payload.description ?? "").trim();
        const club = {
          id: "10000000-0000-4000-8000-000000000099",
          name: String(payload.name).trim(),
          ...(description ? { description } : {}),
          lifecycle: "ACTIVE",
          membershipRole: "ADMIN",
          selectionScaleMin: payload.selectionScaleMin,
          selectionScaleMax: payload.selectionScaleMax,
          tier: "FREE",
        };
        clubsBySession.set(token, [club]);
        sendJson(response, 201, { club });
      });
      return;
    }
    response.writeHead(405).end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/contact") {
    response.writeHead(404).end();
    return;
  }

  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const payload = JSON.parse(body);
    const send = (status, result) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
    };

    if (payload.message === "Rate limited message") {
      send(429, { error: { code: "RATE_LIMITED", message: "Too many requests.", requestId: "request-1" } });
      return;
    }
    if (payload.message === "Service unavailable message") {
      send(503, { error: { code: "SERVICE_UNAVAILABLE", message: "Unavailable.", requestId: "request-2" } });
      return;
    }
    if (payload.message === "Retry this exact message") {
      const previousKey = retryKeys.get(payload.message);
      if (!previousKey) {
        retryKeys.set(payload.message, payload.submissionKey);
        send(503, { error: { code: "SERVICE_UNAVAILABLE", message: "Unavailable.", requestId: "request-3" } });
        return;
      }
      if (previousKey !== payload.submissionKey) {
        send(409, { error: { code: "CONFLICT", message: "Conflict.", requestId: "request-4" } });
        return;
      }
    }

    const complete = () => send(202, {
      id: "contact-1",
      status: payload.message === "Duplicate message" ? "duplicate" : "accepted",
    });
    if (payload.message === "Slow Contact response") {
      setTimeout(complete, 300);
    } else {
      complete();
    }
  });
});

await new Promise((resolve, reject) => {
  api.once("error", reject);
  api.listen(0, "127.0.0.1", resolve);
});
const apiAddress = api.address();
if (!apiAddress || typeof apiAddress === "string") {
  throw new Error("The Contact test API did not bind a TCP port.");
}

const web = spawn(process.execPath, ["apps/web/.next/standalone/apps/web/server.js"], {
  env: {
    ...process.env,
    BACKEND_INTERNAL_URL: `http://127.0.0.1:${apiAddress.port}`,
    HOSTNAME: "127.0.0.1",
    PORT: "41730",
  },
  stdio: "inherit",
});

const stop = () => {
  web.kill("SIGTERM");
  api.close();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
web.once("exit", (code) => {
  api.close();
  process.exitCode = code ?? 1;
});
