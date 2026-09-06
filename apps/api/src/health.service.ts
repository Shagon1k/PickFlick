import { Inject, Injectable } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { LivenessReport, ReadinessReport } from "@pickflick/contracts";
import { checkDatabaseReadiness } from "@pickflick/database";
import { checkReadiness, createRuntimeDependencyProbes, type DependencyProbe } from "@pickflick/observability";

import { RUNTIME_ENVIRONMENT } from "./runtime.tokens.js";

@Injectable()
export class HealthService {
  private readonly probes: readonly DependencyProbe[];

  constructor(@Inject(RUNTIME_ENVIRONMENT) environment: RuntimeEnvironment) {
    this.probes = createRuntimeDependencyProbes(environment, (timeoutMilliseconds) =>
      checkDatabaseReadiness(environment.databaseUrl, timeoutMilliseconds),
    );
  }

  liveness(): LivenessReport {
    return { service: "api", status: "alive" };
  }

  readiness(): Promise<ReadinessReport> {
    return checkReadiness(this.probes);
  }
}
