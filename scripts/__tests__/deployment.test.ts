import { beforeAll, describe, expect, it } from "vitest";

import { checkDeployment, renderDeployment, validateDeployments } from "../check-deployment.mjs";

type Deployments = ReturnType<typeof checkDeployment>;

let validDeployments: Deployments;

beforeAll(() => {
  validDeployments = checkDeployment();
});

function expectRejected(mutate: (deployments: Deployments) => void, message: RegExp) {
  const deployments = structuredClone(validDeployments);
  mutate(deployments);

  expect(() => validateDeployments(deployments)).toThrow(message);
}

describe("deployment Compose", () => {
  it("renders isolated UAT and production topologies", () => {
    expect(validDeployments.uat.name).toBe("pickflick-uat");
    expect(validDeployments.production.name).toBe("pickflick-production");
    expect(Object.keys(validDeployments.uat.services).sort()).toEqual(["api", "release", "web", "worker"]);
    expect(validDeployments.uat.services.worker.networks.application.aliases).toContain("pickflick-uat-worker");
  });

  it("refuses local and test deployment scopes", () => {
    expect(() => renderDeployment("local")).toThrow(/only render for uat or production/);
    expect(() => renderDeployment("test")).toThrow(/only render for uat or production/);
  });

  it("does not require a source revision in the deployment environment", () => {
    const deployment = renderDeployment("uat");

    expect(deployment.services.api.environment.SOURCE_REVISION).toBeUndefined();
    expect(deployment.networks.application.name).toBe("dokploy-network");
  });

  it("converges the native Compose release dependency graph", () => {
    const deployment = validDeployments.uat;

    expect(deployment.services.release.profiles).toBeUndefined();
    expect(deployment.services.api.depends_on.release).toMatchObject({
      condition: "service_completed_successfully",
      required: true,
    });
    expect(deployment.services.worker.depends_on.release).toMatchObject({
      condition: "service_completed_successfully",
      required: true,
    });
    expect(deployment.services.web.depends_on.api).toMatchObject({
      condition: "service_healthy",
      required: true,
    });
  });
  it("accepts the proportional topology without deferred timeout coupling", () => {
    const deployments = structuredClone(validDeployments);

    for (const deployment of Object.values(deployments)) {
      delete deployment.services.api.stop_grace_period;
      delete deployment.services.worker.stop_grace_period;
    }

    expect(validateDeployments(deployments)).toEqual(deployments);
    expect(deployments.uat.services).not.toHaveProperty("postgres");
    expect(deployments.uat.services).not.toHaveProperty("redis");
    expect(deployments.uat.services.worker.networks).not.toHaveProperty("egress");
    expect(deployments.uat.services.web).not.toHaveProperty("image");
  });

  it("rejects every omitted runtime-required environment variable", () => {
    for (const [serviceName, variableName] of [
      ["api", "SHUTDOWN_TIMEOUT_MS"],
      ["api", "API_HOST"],
      ["api", "API_PORT"],
      ["worker", "SHUTDOWN_TIMEOUT_MS"],
    ] as const) {
      expectRejected(
        (deployments) => delete deployments.uat.services[serviceName].environment[variableName],
        new RegExp(`${serviceName} must receive ${variableName}`),
      );
    }
  });

  it("routes the public API path through web to the environment-specific API alias", () => {
    expect(validDeployments.uat.services.web.build.args.BACKEND_INTERNAL_URL).toBe(
      "http://pickflick-uat-api:3001",
    );
    expect(validDeployments.production.services.web.environment.BACKEND_INTERNAL_URL).toBe(
      "http://pickflick-production-api:3001",
    );
  });

  it("rejects release services that replace the release image behavior", () => {
    expectRejected(
      (deployments) => (deployments.uat.services.release.build.target = "api"),
      /release gate must build the release target/,
    );
    expectRejected(
      (deployments) => (deployments.uat.services.release.command = ["node", "dist/main.js"]),
      /release gate must use the image command/,
    );
    expectRejected(
      (deployments) => (deployments.uat.services.release.entrypoint = ["/bin/true"]),
      /release gate must use the image entrypoint/,
    );
  });

  it("rejects health checks disabled with NONE", () => {
    for (const serviceName of ["api", "web"] as const) {
      expectRejected(
        (deployments) => (deployments.uat.services[serviceName].healthcheck.test = ["NONE"]),
        new RegExp(`${serviceName === "api" ? "API" : "Web"} must define an enabled health check`),
      );
    }
  });

  it("rejects always-successful replacements for the intended health checks", () => {
    for (const serviceName of ["api", "web"] as const) {
      expectRejected(
        (deployments) => (deployments.uat.services[serviceName].healthcheck.test = ["CMD-SHELL", "exit 0"]),
        new RegExp(`${serviceName === "api" ? "API" : "Web"} must define its intended health check`),
      );
    }
  });

  it.each([
    {
      name: "a missing application service",
      mutate: (deployments: Deployments) => delete deployments.uat.services.worker,
      message: /must contain only api, release, web, and worker/,
    },
    {
      name: "a missing required runtime input",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.environment.DATABASE_URL = ""),
      message: /api must receive DATABASE_URL/,
    },
    {
      name: "a service with the wrong selected environment",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.environment.APP_ENV = "production"),
      message: /API must use the selected environment/,
    },
    {
      name: "a release service assigned a Compose profile",
      mutate: (deployments: Deployments) => (deployments.uat.services.release.profiles = ["release"]),
      message: /release gate must use native Compose ordering/,
    },
    {
      name: "a runtime service assigned a Compose profile",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.profiles = ["application"]),
      message: /api must use native Compose ordering/,
    },
    {
      name: "a release dependency on an application service",
      mutate: (deployments: Deployments) =>
        (deployments.uat.services.release.depends_on = { api: { condition: "service_healthy", required: true } }),
      message: /release gate must not depend on application services/,
    },
    {
      name: "a runtime service with the wrong build target",
      mutate: (deployments: Deployments) => (deployments.uat.services.worker.build.target = "api"),
      message: /worker must build the worker target/,
    },
    {
      name: "an API service that does not wait for the release gate",
      mutate: (deployments: Deployments) =>
        (deployments.uat.services.api.depends_on = { release: { condition: "service_started", required: true } }),
      message: /api must wait for the release gate/,
    },
    {
      name: "a worker service that does not wait for the release gate",
      mutate: (deployments: Deployments) => delete deployments.uat.services.worker.depends_on,
      message: /worker must wait for the release gate/,
    },
    {
      name: "a missing API health check",
      mutate: (deployments: Deployments) => delete deployments.uat.services.api.healthcheck,
      message: /API must define an enabled health check/,
    },
    {
      name: "a missing web health check",
      mutate: (deployments: Deployments) => delete deployments.uat.services.web.healthcheck,
      message: /Web must define an enabled health check/,
    },
    {
      name: "web startup without the API health gate",
      mutate: (deployments: Deployments) => (deployments.uat.services.web.depends_on.api.condition = "service_started"),
      message: /Web must wait for API health/,
    },
    {
      name: "a web proxy targeting the wrong API alias",
      mutate: (deployments: Deployments) =>
        (deployments.uat.services.web.build.args.BACKEND_INTERNAL_URL = "http://api:3001"),
      message: /same-origin API proxy/,
    },
    {
      name: "an optional API health dependency",
      mutate: (deployments: Deployments) => (deployments.uat.services.web.depends_on.api.required = false),
      message: /Web must require API health/,
    },
    {
      name: "a directly published application port",
      mutate: (deployments: Deployments) => (deployments.uat.services.web.ports = ["3000:3000"]),
      message: /web must not publish host ports/,
    },
    {
      name: "a colliding Compose project name",
      mutate: (deployments: Deployments) => (deployments.uat.name = deployments.production.name),
      message: /uat must use its own Compose project name/,
    },
    {
      name: "a missing environment-specific alias",
      mutate: (deployments: Deployments) => (deployments.uat.services.worker.networks.application.aliases = ["worker"]),
      message: /worker must use its environment-specific service alias/,
    },
    {
      name: "a cross-service environment alias collision",
      mutate: (deployments: Deployments) =>
        deployments.uat.services.api.networks.application.aliases.push("pickflick-production-worker"),
      message: /UAT and production service aliases must be environment-isolated/,
    },
    {
      name: "a same-environment alias collision",
      mutate: (deployments: Deployments) =>
        deployments.uat.services.api.networks.application.aliases.push("pickflick-uat-worker"),
      message: /uat service aliases must each have one owner/,
    },
    {
      name: "a writable root filesystem",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.read_only = false),
      message: /api must use a read-only root filesystem/,
    },
    {
      name: "a missing init process",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.init = false),
      message: /api must use an init process/,
    },
    {
      name: "retained Linux capabilities",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.cap_drop = []),
      message: /api must drop Linux capabilities/,
    },
    {
      name: "new process privileges",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.security_opt = []),
      message: /api must prevent new privileges/,
    },
    {
      name: "a missing temporary write path",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.tmpfs = []),
      message: /api must mount \/tmp as tmpfs/,
    },
    {
      name: "an application network outside Dokploy's shared network",
      mutate: (deployments: Deployments) => (deployments.uat.networks.application.name = "other-network"),
      message: /Application services must use Dokploy's shared network/,
    },
  ])("rejects $name", ({ mutate, message }) => {
    expectRejected(mutate, message);
  });
});
