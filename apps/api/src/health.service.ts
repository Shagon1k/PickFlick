import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { LivenessReport, ReadinessReport } from "@pickflick/contracts";
import { createDatabaseClient } from "@pickflick/database";
import { checkReadiness, createRuntimeDependencyProbes, type DependencyProbe } from "@pickflick/observability";

import { RUNTIME_ENVIRONMENT } from "./runtime.tokens.js";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly database;
  private readonly probes: readonly DependencyProbe[];

  constructor(@Inject(RUNTIME_ENVIRONMENT) environment: RuntimeEnvironment) {
    this.database = createDatabaseClient(environment.databaseUrl);
    this.probes = createRuntimeDependencyProbes(environment, async () => {
      await this.database.$queryRaw`SELECT 1`;
    });
  }

  liveness(): LivenessReport {
    return { service: "api", status: "alive" };
  }

  readiness(): Promise<ReadinessReport> {
    return checkReadiness(this.probes);
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }
}
