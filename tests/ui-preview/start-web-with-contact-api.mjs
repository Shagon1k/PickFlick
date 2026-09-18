import { spawn } from "node:child_process";
import { createServer } from "node:http";

const retryKeys = new Map();
const clubsBySession = new Map();
const avatarVersionsBySession = new Map();
const settingsClubId = "10000000-0000-4000-8000-000000000031";

function settingsProjection(token) {
  const role = token?.includes("member") ? "MEMBER" : token?.includes("moderator") ? "MODERATOR" : "ADMIN";
  const lifecycle = token?.includes("archived") ? "ARCHIVED" : "ACTIVE";
  const admin = role === "ADMIN";
  const active = lifecycle === "ACTIVE";
  const avatarVersion = avatarVersionsBySession.get(token);
  return {
    club: {
      id: settingsClubId,
      name: "Midnight Society",
      description: "Noir, classics, and arguments.",
      hasAvatar: Boolean(avatarVersion),
      ...(avatarVersion ? { avatarVersion } : {}),
      lifecycle,
      membershipRole: role,
      selectionScaleMin: 0,
      selectionScaleMax: 7,
      tier: "FREE",
    },
    permissions: {
      viewClub: true,
      participate: active,
      leaveClub: !admin,
      manageSessions: active && role !== "MEMBER",
      manageMembers: active && admin,
      manageRoles: active && admin,
      manageSettings: active && admin,
      manageLifecycle: admin,
      viewAudit: admin,
    },
    entitlements: {
      tier: "FREE",
      adminClubLimit: 1,
      memberLimit: 8,
      blockingSessionLimit: 1,
      inactivityGraceDays: 90,
      voteResultVisibility: "ADMIN_HIDDEN",
      analyticsTier: "BASIC",
    },
    visibility: {
      showNominationAuthors: true,
      showNominationsBeforeSubmit: true,
      showVoteResults: false,
      showRatingResults: true,
      useMonochromeMedia: true,
    },
    members: [
      { id: "20000000-0000-4000-8000-000000000031", displayName: "Avery Admin", role: "ADMIN", joinedAt: "2026-01-01T00:00:00.000Z" },
      { id: "20000000-0000-4000-8000-000000000032", displayName: "Morgan Member", role: "MEMBER", joinedAt: "2026-02-01T00:00:00.000Z" },
    ],
    auditEvents: admin ? [{
      id: "50000000-0000-4000-8000-000000000031",
      action: "CLUB_SETTINGS_UPDATED",
      changed: true,
      createdAt: "2026-09-18T12:00:00.000Z",
    }] : [],
  };
}

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
          hasAvatar: false,
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
  if (request.url?.startsWith(`/clubs/${settingsClubId}`)) {
    const token = sessionToken(request);
    if (!token?.startsWith("valid")) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "Authentication required.", requestId: "request-settings-auth" } });
      return;
    }
    if (token.includes("settings-outsider")) {
      sendJson(response, 403, { error: { code: "FORBIDDEN", message: "Forbidden.", requestId: "request-settings-private" } });
      return;
    }
    if (request.method === "GET" && request.url.endsWith("/settings")) {
      sendJson(response, 200, settingsProjection(token));
      return;
    }
    if (request.method === "PATCH" && request.url.endsWith("/settings")) {
      sendJson(response, 200, { changed: true, replayed: false, settings: settingsProjection(token) });
      return;
    }
    if (request.method === "PATCH" && request.url.includes("/members/") && request.url.endsWith("/role")) {
      sendJson(response, token.includes("settings-admin") ? 200 : 403, token.includes("settings-admin")
        ? { changed: true, replayed: false }
        : { error: { code: "FORBIDDEN", message: "Forbidden.", requestId: "request-role-private" } });
      return;
    }
    if (request.method === "POST" && /\/(archive|reactivate|leave|delete)$/u.test(request.url)) {
      sendJson(response, 200, { changed: true, replayed: false });
      return;
    }
    if (request.method === "PUT" && request.url.endsWith("/avatar")) {
      const nextVersion = `avatar-${Number(avatarVersionsBySession.get(token)?.split("-")[1] ?? 0) + 1}`;
      avatarVersionsBySession.set(token, nextVersion);
      request.resume();
      sendJson(response, 200, { changed: true, hasAvatar: true, replayed: false });
      return;
    }
    if (request.method === "DELETE" && request.url.endsWith("/avatar")) {
      avatarVersionsBySession.delete(token);
      request.resume();
      sendJson(response, 200, { changed: true, hasAvatar: false, replayed: false });
      return;
    }
    response.writeHead(404).end();
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
