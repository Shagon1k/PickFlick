import { describe, expect, it } from "vitest";

import { checkDeployment, renderDeployment } from "../check-deployment.mjs";

describe("deployment Compose", () => {
  it("renders isolated UAT and production topologies", () => {
    const deployments = checkDeployment();

    expect(deployments.uat.name).toBe("pickflick-uat");
    expect(deployments.production.name).toBe("pickflick-production");
    expect(deployments.uat.services.worker.networks).toHaveProperty("egress");
  });

  it("refuses local and test deployment scopes", () => {
    expect(() => renderDeployment("local")).toThrow(/only render for uat or production/);
    expect(() => renderDeployment("test")).toThrow(/only render for uat or production/);
  });

  it("rejects an explicit mutable deployment image", () => {
    expect(() => renderDeployment("uat", { WEB_IMAGE: "registry.invalid/pickflick-web:latest" })).toThrow(
      /WEB_IMAGE must be an immutable image reference pinned by a SHA-256 digest/,
    );
  });

  it("does not replace an explicitly empty deployment image with a synthetic reference", () => {
    expect(() => renderDeployment("uat", { WORKER_IMAGE: "" })).toThrow(
      /WORKER_IMAGE must be an immutable image reference pinned by a SHA-256 digest/,
    );
  });

  it("renders an explicit digest-qualified deployment image", () => {
    const webImage = `registry.example/pickflick-web@sha256:${"b".repeat(64)}`;

    expect(renderDeployment("uat", { WEB_IMAGE: webImage }).services.web.image).toBe(webImage);
  });

  it("validates the explicit deployment shutdown relationship", () => {
    expect(() =>
      renderDeployment("uat", { SHUTDOWN_GRACE_PERIOD: "2m", SHUTDOWN_TIMEOUT_MS: "120000" }),
    ).toThrow(/SHUTDOWN_GRACE_PERIOD must be greater than SHUTDOWN_TIMEOUT_MS/);
  });

  it("accepts an explicit multi-minute deployment shutdown window", () => {
    const deployment = renderDeployment("uat", {
      SHUTDOWN_GRACE_PERIOD: "2m1s",
      SHUTDOWN_TIMEOUT_MS: "120000",
    });

    expect(deployment.services.worker.stop_grace_period).toBe("2m1s");
  });
});
