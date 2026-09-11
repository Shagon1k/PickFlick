import type { ServerResponse } from "node:http";

import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { LivenessReport, ReadinessReport } from "@pickflick/contracts";
import type { ApplicationLogger } from "@pickflick/observability";

import { HealthService } from "./health.service.js";
import { APPLICATION_LOGGER } from "./runtime.tokens.js";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthService,
    @Inject(APPLICATION_LOGGER) private readonly logger: ApplicationLogger,
  ) {}

  @Get("live")
  liveness(): LivenessReport {
    return this.health.liveness();
  }

  @Get("ready")
  async readiness(@Res({ passthrough: true }) response: ServerResponse): Promise<ReadinessReport> {
    const report = await this.health.readiness();
    if (report.status === "not_ready") {
      response.statusCode = 503;
      this.logger.warn(
        { event: "readiness.not_ready", checks: report.checks },
        "API readiness has unavailable dependencies.",
      );
    }
    return report;
  }
}
