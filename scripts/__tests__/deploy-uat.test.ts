import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DOKPLOY_COMPOSE_PATH,
  UAT_DEFAULT_REF,
  canonicalComposePath,
  deployUat,
  deploymentConfiguration,
  waitForDokployDeployment,
  waitForUatReadiness,
} from "../deploy-uat.mjs";

const source = {
  CF_ACCESS_CLIENT_ID: "cloudflare-client",
  CF_ACCESS_CLIENT_SECRET: "cloudflare-secret",
  DOKPLOY_API_TOKEN: "dokploy-token",
  DOKPLOY_UAT_COMPOSE_ID: "compose_123",
  DOKPLOY_URL: "https://dokploy.example.invalid",
  GITHUB_REPOSITORY: "Shagon1k/PickFlick",
  SOURCE_REVISION: "a".repeat(40),
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
    composePath: DOKPLOY_COMPOSE_PATH,
    composeStatus: "done",
    composeType: "docker-compose",
    deployments: [{ deploymentId: "deployment-old", status: "done" }],
    owner: "Shagon1k",
    repository: "PickFlick",
    sourceType: "github",
  };
}

function readyHealth(pathname: string, revision = source.SOURCE_REVISION) {
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
  it("accepts an equivalent Dokploy Compose path with a leading current-directory prefix", () => {
    expect(canonicalComposePath("./compose.deploy.yaml")).toBe(DOKPLOY_COMPOSE_PATH);
    expect(canonicalComposePath("compose.deploy.yaml")).toBe(DOKPLOY_COMPOSE_PATH);
    expect(canonicalComposePath("compose.other.yaml")).toBe("compose.other.yaml");
  });

  it("triggers the configured main Compose resource without rewriting it", async () => {
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
        const compose = composeContract();
        return jsonResponse({
          ...compose,
          deployments: composeReads === 2
            ? [
                ...compose.deployments,
                { description: `Commit: ${source.SOURCE_REVISION}`, deploymentId: "deployment-new", status: "done" },
              ]
            : compose.deployments,
        });
      }
      if (url.pathname === "/api/compose.deploy") {
        return jsonResponse({ composeId: "compose_123", success: true });
      }
      if (url.pathname.startsWith("/api/health/")) {
        return jsonResponse(readyHealth(url.pathname));
      }
      throw new Error(`Unexpected request: ${method} ${url.href}`);
    });

    await expect(deployUat(source, fetchImplementation, { sleep: vi.fn() })).resolves.toBeUndefined();

    expect(requests.find(({ pathname }) => pathname === "/api/compose.deploy"))
      .toMatchObject({
        body: {
          composeId: "compose_123",
          description: `Automated UAT deployment for Shagon1k/PickFlick@${source.SOURCE_REVISION}`,
          freshVolumes: false,
          title: "PickFlick UAT aaaaaaaaaaaa",
        },
      });
    expect(requests.map(({ pathname }) => pathname)).not.toContain("/api/compose.update");
    expect(requests.map(({ pathname }) => pathname)).not.toContain("/api/compose.saveEnvironment");
    expect(requests.some(({ pathname }) => pathname.includes("/git/"))).toBe(false);
  });

  it("checks the Dokploy main-resource contract before changing external state", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({ ...composeContract(), branch: "release" }));

    await expect(deployUat(source, fetchImplementation)).rejects.toThrow(/branch=main/);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("refuses to overlap a deployment already running outside the workflow", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({ ...composeContract(), composeStatus: "running" }));

    await expect(deployUat(source, fetchImplementation)).rejects.toThrow(/already has a running deployment/);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("rejects a Dokploy URL that could disclose credentials or use plaintext transport", () => {
    expect(() => deploymentConfiguration({ ...source, DOKPLOY_URL: "http://user:pass@dokploy.invalid/api" }))
      .toThrow(/must be an HTTPS origin/);
  });

  it("requires the exact source revision expected from Dokploy and runtime health", () => {
    expect(() => deploymentConfiguration({ ...source, SOURCE_REVISION: "main" }))
      .toThrow(/full 40-character hexadecimal Git SHA/);
  });
});

describe("Dokploy deployment status", () => {
  it("accepts the triggered deployment as done on its first poll", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({
      ...composeContract(),
      deployments: [
        ...composeContract().deployments,
        { description: `Commit: ${source.SOURCE_REVISION}`, deploymentId: "deployment-new", status: "done" },
      ],
    }));

    await expect(waitForDokployDeployment(deploymentConfiguration(source), new Set(["deployment-old"]), {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).resolves.toBe("deployment-new");
  });

  it("rejects a completed deployment that cloned another revision", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({
      ...composeContract(),
      deployments: [
        ...composeContract().deployments,
        { description: `Commit: ${"b".repeat(40)}`, deploymentId: "deployment-new", status: "done" },
      ],
    }));

    await expect(waitForDokployDeployment(deploymentConfiguration(source), new Set(["deployment-old"]), {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).rejects.toThrow(/different UAT source revision/);
  });

  it("waits for Dokploy to replace the request description with the cloned revision", async () => {
    let reads = 0;
    const fetchImplementation = vi.fn(async () => {
      reads += 1;
      return jsonResponse({
        ...composeContract(),
        deployments: [
          ...composeContract().deployments,
          {
            description: reads === 1
              ? `Automated UAT deployment for Shagon1k/PickFlick@${source.SOURCE_REVISION}`
              : `Commit: ${source.SOURCE_REVISION}`,
            deploymentId: "deployment-new",
            status: "done",
          },
        ],
      });
    });

    await expect(waitForDokployDeployment(deploymentConfiguration(source), new Set(["deployment-old"]), {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).resolves.toBe("deployment-new");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("fails when the triggered Dokploy deployment reports an error", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse({
      ...composeContract(),
      deployments: [...composeContract().deployments, { deploymentId: "deployment-new", status: "error" }],
    }));

    await expect(waitForDokployDeployment(deploymentConfiguration(source), new Set(["deployment-old"]), {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).rejects.toThrow(/failed UAT deployment/);
  });
});

describe("UAT workflow", () => {
  const workflow = readFileSync(resolve(".github/workflows/deploy-uat.yml"), "utf8");

  it("checks out and verifies the exact triggering revision", () => {
    expect(workflow).toContain("ref: ${{ steps.revision.outputs.revision }}");
    expect(workflow).toContain("SOURCE_REVISION: ${{ steps.revision.outputs.revision }}");
    expect(workflow).toContain("pnpm uat:deploy");
  });
});

describe("UAT readiness", () => {
  it("waits until both health endpoints report ready dependencies", async () => {
    let attempts = 0;
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      attempts += 1;
      if (attempts <= 2) {
        return jsonResponse(undefined, 503);
      }
      return jsonResponse(readyHealth(pathname));
    });

    await expect(waitForUatReadiness(source.SOURCE_REVISION, {
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

    await expect(waitForUatReadiness(source.SOURCE_REVISION, {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });

  it("waits for the live API to report the exact deployed revision", async () => {
    let livenessReads = 0;
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith("/live")) {
        livenessReads += 1;
        return jsonResponse(readyHealth(pathname, livenessReads === 1 ? "b".repeat(40) : source.SOURCE_REVISION));
      }
      return jsonResponse(readyHealth(pathname));
    });

    await expect(waitForUatReadiness(source.SOURCE_REVISION, {
      fetchImplementation,
      intervalMilliseconds: 0,
      sleep: vi.fn(),
      timeoutMilliseconds: 1_000,
    })).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });
});
