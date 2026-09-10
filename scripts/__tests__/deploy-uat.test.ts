import { describe, expect, it, vi } from "vitest";

import {
  DOKPLOY_COMPOSE_PATH,
  DOKPLOY_DEPLOY_COMMAND,
  UAT_DEFAULT_REF,
  deployUat,
  deploymentConfiguration,
  dokployEnvironment,
  uatRestoreTag,
  waitForDokployDeployment,
  waitForUatRevision,
} from "../deploy-uat.mjs";

const revision = "a".repeat(40);
const source = {
  CF_ACCESS_CLIENT_ID: "cloudflare-client",
  CF_ACCESS_CLIENT_SECRET: "cloudflare-secret",
  DOKPLOY_API_TOKEN: "dokploy-token",
  DOKPLOY_UAT_COMPOSE_ID: "compose_123",
  DOKPLOY_URL: "https://dokploy.example.invalid",
  GITHUB_REPOSITORY: "Shagon1k/PickFlick",
  GITHUB_TOKEN: "github-token",
  SOURCE_REVISION: revision,
  UAT_RESTORE_REVISION: "false",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function composeContract() {
  return {
    autoDeploy: false,
    branch: UAT_DEFAULT_REF,
    command: DOKPLOY_DEPLOY_COMMAND,
    composePath: DOKPLOY_COMPOSE_PATH,
    composeStatus: "done",
    composeType: "docker-compose",
    owner: "Shagon1k",
    repository: "PickFlick",
    sourceType: "github",
  };
}

function readyHealth(pathname: string) {
  return pathname.endsWith("/live")
    ? { revision, service: "api", status: "alive" }
    : {
        checks: [
          { name: "database", status: "up" },
          { name: "redis", status: "up" },
          { name: "objectStorage", status: "up" },
        ],
        status: "ready",
      };
}

describe("UAT deployment", () => {
  it("deploys main, saves reference-only environment data, and waits for Dokploy", async () => {
    let composeReads = 0;
    const requests: Array<{ body?: unknown; method: string; pathname: string }> = [];
    const fetchImplementation = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      requests.push({
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
        method,
        pathname: url.pathname,
      });
      if (url.pathname === "/api/compose.one") {
        composeReads += 1;
        return jsonResponse({
          ...composeContract(),
          composeStatus: composeReads === 3 ? "running" : "done",
        });
      }
      if (url.pathname === "/api/compose.saveEnvironment") {
        return jsonResponse({});
      }
      if (url.pathname === "/api/compose.deploy") {
        return jsonResponse({ success: true });
      }
      if (url.pathname.startsWith("/api/health/")) {
        return jsonResponse(readyHealth(url.pathname));
      }
      throw new Error(`Unexpected request: ${method} ${url.href}`);
    });

    await expect(deployUat(source, fetchImplementation, { sleep: vi.fn() })).resolves.toBe(revision);

    expect(requests.some(({ pathname }) => pathname.startsWith(`/repos/`))).toBe(false);
    const environmentSave = requests.find(({ pathname }) => pathname === "/api/compose.saveEnvironment");
    expect(environmentSave?.body).toEqual({
      composeId: "compose_123",
      createEnvFile: true,
      env: dokployEnvironment(revision),
    });
    expect(JSON.stringify(environmentSave?.body)).not.toContain("github-token");
    expect(JSON.stringify(environmentSave?.body)).not.toContain("dokploy-token");
    expect(JSON.stringify(environmentSave?.body)).not.toContain("cloudflare-secret");
    expect(environmentSave?.body).toMatchObject({
      env: expect.stringContaining("RESEND_API_KEY=${{environment.RESEND_API_KEY}}"),
    });
    expect(environmentSave?.body).toMatchObject({
      env: expect.stringContaining("STORAGE_ENDPOINT=${{environment.STORAGE_ENDPOINT}}"),
    });
    expect(JSON.stringify(environmentSave?.body)).not.toContain("SMTP_HOST");
    expect(JSON.stringify(environmentSave?.body)).not.toContain("S3_ENDPOINT");
    expect(requests.at(-1)?.pathname).toBe("/api/health/ready");
  });

  it("returns a restored Dokploy resource to main before automatic delivery", async () => {
    let composeReads = 0;
    const requests: Array<{ body?: unknown; method: string; pathname: string }> = [];
    const fetchImplementation = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      requests.push({
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
        method,
        pathname: url.pathname,
      });
      if (url.pathname === "/api/compose.one") {
        composeReads += 1;
        return jsonResponse({
          ...composeContract(),
          branch: composeReads === 1 ? uatRestoreTag("b".repeat(40)) : UAT_DEFAULT_REF,
          composeStatus: composeReads === 3 ? "running" : "done",
        });
      }
      if (url.pathname === "/api/compose.update") {
        return jsonResponse({ autoDeploy: false, branch: UAT_DEFAULT_REF });
      }
      if (url.pathname === "/api/compose.saveEnvironment") {
        return jsonResponse({});
      }
      if (url.pathname === "/api/compose.deploy") {
        return jsonResponse({ success: true });
      }
      if (url.pathname.startsWith("/api/health/")) {
        return jsonResponse(readyHealth(url.pathname));
      }
      throw new Error(`Unexpected request: ${method} ${url.href}`);
    });

    await deployUat(source, fetchImplementation, { sleep: vi.fn() });

    expect(requests.find(({ method, pathname }) => method === "POST" && pathname === "/api/compose.update"))
      .toMatchObject({ body: { autoDeploy: false, branch: UAT_DEFAULT_REF, composeId: "compose_123" } });
  });

  it("checks the immutable Dokploy contract before changing external state", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({ ...composeContract(), autoDeploy: true }));

    await expect(deployUat(source, fetchImplementation)).rejects.toThrow(/autoDeploy=false/);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("refuses to overlap a deployment already running outside the workflow", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({
      ...composeContract(),
      composeStatus: "running",
    }));

    await expect(deployUat(source, fetchImplementation)).rejects.toThrow(/already has a running deployment/);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("recognizes an explicitly confirmed manual restore", () => {
    expect(deploymentConfiguration({ ...source, UAT_RESTORE_REVISION: "true" }).restoreRevision).toBe(true);
  });

  it("rejects a missing or invalid restore decision", () => {
    expect(() => deploymentConfiguration({ ...source, UAT_RESTORE_REVISION: undefined }))
      .toThrow(/UAT_RESTORE_REVISION is required/);
    expect(() => deploymentConfiguration({ ...source, UAT_RESTORE_REVISION: "yes" }))
      .toThrow(/UAT_RESTORE_REVISION must be true or false/);
  });

  it("pins an immutable tag only for an explicitly confirmed manual rollback", async () => {
    let composeReads = 0;
    const restoreTag = uatRestoreTag(revision);
    const requests: Array<{ body?: unknown; method: string; pathname: string }> = [];
    const fetchImplementation = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      requests.push({
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
        method,
        pathname: url.pathname,
      });
      if (url.pathname === "/api/compose.one") {
        composeReads += 1;
        return jsonResponse({
          ...composeContract(),
          composeStatus: composeReads === 3 ? "running" : "done",
        });
      }
      if (url.pathname.endsWith(`/git/ref/tags/${restoreTag}`)) {
        return jsonResponse({ message: "Not Found" }, 404);
      }
      if (url.pathname.endsWith("/git/refs")) {
        return jsonResponse({ object: { sha: revision } }, 201);
      }
      if (url.pathname === "/api/compose.update") {
        return jsonResponse({ autoDeploy: false, branch: restoreTag });
      }
      if (url.pathname === "/api/compose.saveEnvironment") {
        return jsonResponse({});
      }
      if (url.pathname === "/api/compose.deploy") {
        return jsonResponse({ success: true });
      }
      if (url.pathname.startsWith("/api/health/")) {
        return jsonResponse(readyHealth(url.pathname));
      }
      throw new Error(`Unexpected request: ${method} ${url.href}`);
    });

    await deployUat({ ...source, UAT_RESTORE_REVISION: "true" }, fetchImplementation, { sleep: vi.fn() });

    expect(requests.find(({ method, pathname }) => method === "POST" && pathname.endsWith("/git/refs")))
      .toMatchObject({ body: { ref: `refs/tags/${restoreTag}`, sha: revision } });
    expect(requests.find(({ pathname }) => pathname === "/api/compose.update"))
      .toMatchObject({ body: { autoDeploy: false, branch: restoreTag, composeId: "compose_123" } });
  });

  it("rejects a Dokploy URL that could disclose credentials or use plaintext transport", () => {
    expect(() => deploymentConfiguration({ ...source, DOKPLOY_URL: "http://user:pass@dokploy.invalid/api" }))
      .toThrow(/must be an HTTPS origin/);
  });
});

describe("Dokploy deployment status", () => {
  it("fails when Dokploy reports a deployment error", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({ composeStatus: "error" }));

    await expect(waitForDokployDeployment(deploymentConfiguration(source), {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).rejects.toThrow(/failed UAT deployment/);
  });
});

describe("UAT readiness", () => {
  it("waits until both health endpoints identify the expected ready revision", async () => {
    let attempts = 0;
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      attempts += 1;
      if (attempts <= 2) {
        return jsonResponse(undefined, 503);
      }
      return jsonResponse(readyHealth(pathname));
    });

    await expect(waitForUatRevision(revision, {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });

  it("rejects a ready response that omits a required dependency", async () => {
    let readinessReads = 0;
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith("/live")) {
        return jsonResponse(readyHealth(pathname));
      }
      readinessReads += 1;
      if (readinessReads === 1) {
        return jsonResponse({ checks: [{ name: "database", status: "up" }], status: "ready" });
      }
      return jsonResponse(readyHealth(pathname));
    });

    await expect(waitForUatRevision(revision, {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });
});
