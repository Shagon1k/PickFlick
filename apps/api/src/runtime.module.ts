import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { ApplicationLogger } from "@pickflick/observability";

import { APPLICATION_LOGGER, RUNTIME_ENVIRONMENT } from "./runtime.tokens.js";

@Global()
@Module({})
export class RuntimeModule {
  static register(environment: RuntimeEnvironment, logger: ApplicationLogger): DynamicModule {
    return {
      module: RuntimeModule,
      providers: [
        { provide: RUNTIME_ENVIRONMENT, useValue: environment },
        { provide: APPLICATION_LOGGER, useValue: logger },
      ],
      exports: [RUNTIME_ENVIRONMENT, APPLICATION_LOGGER],
    };
  }
}
