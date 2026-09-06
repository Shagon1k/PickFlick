import { describe, expect, it } from "vitest";

import { checkDeployment, renderDeployment } from "../check-deployment.mjs";

describe("deployment Compose", () => {
  it("renders isolated UAT and production topologies", () => {
    const deployments = checkDeployment();

    expect(deployments.uat.name).toBe("pickflick-uat");
    expect(deployments.production.name).toBe("pickflick-production");
  });

  it("refuses local and test deployment scopes", () => {
    expect(() => renderDeployment("local")).toThrow(/only render for uat or production/);
    expect(() => renderDeployment("test")).toThrow(/only render for uat or production/);
  });
});
