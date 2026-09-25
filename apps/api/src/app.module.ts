import { randomUUID } from 'node:crypto';

import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import { LoggerModule } from 'nestjs-pino';

import { RuntimeModule } from './config/runtime.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClubsModule } from './modules/clubs/clubs.module.js';
import { ContactModule } from './modules/contact/contact.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { StorageModule } from './modules/storage/storage.module.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

@Module({})
export class AppModule {
    static register(environment: TRuntimeEnvironment): DynamicModule {
        return {
            module: AppModule,
            imports: [
                RuntimeModule.register(environment),
                LoggerModule.forRoot({
                    pinoHttp: {
                        level: environment.appEnvironment === 'test' ? 'silent' : 'info',
                        base: { service: 'api', environment: environment.appEnvironment },
                        // Reuse a caller's request ID only when it is a UUID; otherwise mint one.
                        genReqId: (request, response) => {
                            const incoming = request.headers['x-request-id'];
                            const id =
                                typeof incoming === 'string' && UUID_PATTERN.test(incoming)
                                    ? incoming
                                    : randomUUID();
                            response.setHeader('x-request-id', id);
                            return id;
                        },
                        redact: [
                            'req.headers.cookie',
                            'req.headers.authorization',
                            'res.headers["set-cookie"]',
                        ],
                    },
                }),
                ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
                DatabaseModule,
                StorageModule,
                AuthModule,
                ClubsModule,
                ContactModule,
                HealthModule,
            ],
            providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
        };
    }
}
