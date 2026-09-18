import { Module, type DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { ApplicationLogger } from "@pickflick/observability";

import { AppController } from "./app.controller.js";
import { ContactController } from "./contact/contact.controller.js";
import { ContactMessageRepository, PrismaContactMessageRepository } from "./contact/contact.repository.js";
import { ContactService } from "./contact/contact.service.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { AuthenticationGuard } from "./identity/authorization.guard.js";
import {
  IDENTITY_AUTHORIZATION,
  SSE_AUTHORIZATION_RECHECK_MILLISECONDS,
} from "./identity/authorization.types.js";
import { IdentityService } from "./identity/identity.service.js";
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
      controllers: [AppController, HealthController, ContactController],
      providers: [
        { provide: RUNTIME_ENVIRONMENT, useValue: environment },
        { provide: APPLICATION_LOGGER, useValue: logger },
        HealthService,
        IdentityService,
        { provide: IDENTITY_AUTHORIZATION, useExisting: IdentityService },
        { provide: SSE_AUTHORIZATION_RECHECK_MILLISECONDS, useValue: 30_000 },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
        ContactService,
        { provide: ContactMessageRepository, useClass: PrismaContactMessageRepository },
      ],
    };
  }
}
