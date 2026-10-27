import { randomUUID } from 'node:crypto';

import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import { LoggerModule } from 'nestjs-pino';

import { RuntimeModule } from './config/runtime.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AchievementsModule } from './modules/achievements/achievements.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClubsModule } from './modules/clubs/clubs.module.js';
import { ContactModule } from './modules/contact/contact.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LibraryModule } from './modules/library/library.module.js';
import { MoviesModule } from './modules/movies/movies.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { WatchlistModule } from './modules/watchlist/watchlist.module.js';

// Each client may send 120 requests a minute.
const DEFAULT_RATE_LIMIT = { ttl: 60_000, limit: 120 };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// Invitation URLs can also arrive as a sign-in callback or a same-origin referrer.
export const HTTP_LOG_REDACTIONS = [
    'req.url',
    'req.headers.referer',
    'res.headers.location',
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
];

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
                        base: { service: 'backend', environment: environment.appEnvironment },
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
                        redact: HTTP_LOG_REDACTIONS,
                    },
                }),
                ThrottlerModule.forRoot([DEFAULT_RATE_LIMIT]),
                DatabaseModule,
                StorageModule,
                AuthModule,
                AchievementsModule,
                ClubsModule,
                ContactModule,
                HealthModule,
                LibraryModule,
                MoviesModule,
                SessionsModule,
                NotificationsModule,
                WatchlistModule,
            ],
            providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
        };
    }
}
