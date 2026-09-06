import { Module, type DynamicModule } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";

import { AppController } from "./app.controller.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { RUNTIME_ENVIRONMENT } from "./runtime.tokens.js";

@Module({})
export class AppModule {
  static register(environment: RuntimeEnvironment): DynamicModule {
    return {
      module: AppModule,
      controllers: [AppController, HealthController],
      providers: [
        { provide: RUNTIME_ENVIRONMENT, useValue: environment },
        HealthService,
      ],
    };
  }
}
