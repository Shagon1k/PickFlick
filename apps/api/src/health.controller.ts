import type { ServerResponse } from "node:http";

import { Controller, Get, Res } from "@nestjs/common";
import type { LivenessReport, ReadinessReport } from "@pickflick/contracts";

import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("live")
  liveness(): LivenessReport {
    return this.health.liveness();
  }

  @Get("ready")
  async readiness(@Res({ passthrough: true }) response: ServerResponse): Promise<ReadinessReport> {
    const report = await this.health.readiness();
    if (report.status === "not_ready") {
      response.statusCode = 503;
    }
    return report;
  }
}
