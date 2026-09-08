import { describe, expect, it } from "vitest";

import { checkDeployment, renderDeployment } from "../check-deployment.mjs";

describe("deployment Compose", () => {
  it("renders isolated UAT and production topologies", () => {
    const deployments = checkDeployment();

    expect(deployments.uat.name).toBe("pickflick-uat");
    expect(deployments.production.name).toBe("pickflick-production");
    expect(Object.keys(deployments.uat.services).sort()).toEqual(["api", "release", "web", "worker"]);
    expect(deployments.uat.services.worker.networks.application.aliases).toContain("pickflick-uat-worker");
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

  it("keeps the runtime timeout below the Compose stop grace", () => {
    const deployment = renderDeployment("uat");

    expect(deployment.services.api.environment.SHUTDOWN_TIMEOUT_MS).toBe("10000");
    expect(deployment.services.worker.environment.SHUTDOWN_TIMEOUT_MS).toBe("10000");
    expect(deployment.services.api.stop_grace_period).toBe("15s");
    expect(deployment.services.worker.stop_grace_period).toBe("15s");
  });
});
