import { Module, type DynamicModule } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { ApplicationLogger } from "@pickflick/observability";

import { AppController } from "./app.controller.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { APPLICATION_LOGGER, RUNTIME_ENVIRONMENT } from "./runtime.tokens.js";

@Module({})
export class AppModule {
  /**
   * Supplies the environment that bootstrap has already parsed and validated.
   * A dynamic module lets Nest inject that runtime value without loading process
   * environment variables again inside providers.
   */
  static register(environment: RuntimeEnvironment, logger: ApplicationLogger): DynamicModule {
    return {
      module: AppModule,
      controllers: [AppController, HealthController],
      providers: [
        { provide: RUNTIME_ENVIRONMENT, useValue: environment },
        { provide: APPLICATION_LOGGER, useValue: logger },
        HealthService,
      ],
    };
  }
}
