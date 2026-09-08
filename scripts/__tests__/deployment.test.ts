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

  it("rejects a source build without a full revision", () => {
    expect(() => renderDeployment("uat", { SOURCE_REVISION: "main" })).toThrow(
      /SOURCE_REVISION must be a full hexadecimal source revision/,
    );
  });

  it("builds and reports an explicit full revision", () => {
    const sourceRevision = "b".repeat(40);
    const deployment = renderDeployment("uat", { SOURCE_REVISION: sourceRevision });

    expect(deployment.services.api.build.args.SOURCE_REVISION).toBe(sourceRevision);
    expect(deployment.services.api.environment.SOURCE_REVISION).toBe(sourceRevision);
    expect(deployment.services.web.environment.SOURCE_REVISION).toBe(sourceRevision);
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

  it("rejects release services that replace the release image behavior", () => {
    expectRejected(
      (deployments) => (deployments.uat.services.release.build.target = "api"),
      /release gate must build the release target/,
    );
    expectRejected(
      (deployments) => (deployments.uat.services.release.command = ["node", "dist/main.js"]),
      /release gate must use the image command/,
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
      name: "a release service outside the isolated release profile",
      mutate: (deployments: Deployments) => (deployments.uat.services.release.profiles = ["application"]),
      message: /release gate must use its isolated deployment profile/,
    },
    {
      name: "a runtime service outside the application profile",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.profiles = ["release"]),
      message: /api must use the application convergence profile/,
    },
    {
      name: "an inline release dependency that bypasses staged convergence",
      mutate: (deployments: Deployments) =>
        (deployments.uat.services.api.depends_on = { release: { condition: "service_completed_successfully" } }),
      message: /api must not recreate before the release run/,
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
      name: "a build with the wrong source revision",
      mutate: (deployments: Deployments) =>
        (deployments.uat.services.release.build.args.SOURCE_REVISION = "b".repeat(40)),
      message: /release must build the selected source revision/,
    },
    {
      name: "runtime revision drift",
      mutate: (deployments: Deployments) => (deployments.uat.services.api.environment.SOURCE_REVISION = "b".repeat(40)),
      message: /api must report the selected source revision/,
    },
  ])("rejects $name", ({ mutate, message }) => {
    expectRejected(mutate, message);
  });
});
