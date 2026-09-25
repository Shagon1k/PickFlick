import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { RuntimeEnvironment } from '@pickflick/config/environment';
import type { ApplicationLogger } from '@pickflick/observability';

import { AppController } from './app.controller.js';
import { ClubsModule } from './clubs/clubs.module.js';
import { ContactModule } from './contact/contact.module.js';
import { HealthModule } from './health.module.js';
import { AuthenticationGuard } from './identity/authorization.guard.js';
import { SSE_AUTHORIZATION_RECHECK_MILLISECONDS } from './identity/authorization.types.js';
import { IdentityModule } from './identity/identity.module.js';
import { RuntimeModule } from './runtime.module.js';

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
            imports: [
                RuntimeModule.register(environment, logger),
                IdentityModule,
                ClubsModule,
                ContactModule,
                HealthModule,
            ],
            controllers: [AppController],
            providers: [
                { provide: SSE_AUTHORIZATION_RECHECK_MILLISECONDS, useValue: 30_000 },
                { provide: APP_GUARD, useClass: AuthenticationGuard },
            ],
        };
    }
}
