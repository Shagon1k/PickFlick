import type { ServerResponse } from "node:http";

import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";
import type { HealthService } from "./health.service.js";

describe("HealthController", () => {
  it("keeps liveness independent from dependency readiness", async () => {
    const health = {
      liveness: () => ({ service: "api" as const, status: "alive" as const }),
      readiness: async () => ({
        status: "not_ready" as const,
        checks: [{ name: "database" as const, status: "down" as const }],
      }),
    } as unknown as HealthService;
    const controller = new HealthController(health);
    const response = { statusCode: 200 } as ServerResponse;

    expect(controller.liveness()).toEqual({ service: "api", status: "alive" });
    await expect(controller.readiness(response)).resolves.toEqual({
      status: "not_ready",
      checks: [{ name: "database", status: "down" }],
    });
    expect(response.statusCode).toBe(503);
  });

  it("returns HTTP 200 when every dependency is ready", async () => {
    const health = {
      liveness: () => ({ service: "api" as const, status: "alive" as const }),
      readiness: async () => ({ status: "ready" as const, checks: [] }),
    } as unknown as HealthService;
    const response = { statusCode: 200 } as ServerResponse;

    await new HealthController(health).readiness(response);

    expect(response.statusCode).toBe(200);
  });
});
