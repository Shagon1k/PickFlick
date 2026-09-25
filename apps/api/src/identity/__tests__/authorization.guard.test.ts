import type { AddressInfo } from 'node:net';
import { request, type IncomingMessage, type Server } from 'node:http';
import { Writable } from 'node:stream';

import { Controller, Get, Header, Module, Sse } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { ApplicationLogger } from '@pickflick/observability';
import { createLogger } from '@pickflick/observability';
import { BehaviorSubject } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APPLICATION_LOGGER } from '../../runtime.tokens.js';
import { ApiExceptionFilter } from '../../api-exception.filter.js';
import { AppController } from '../../app.controller.js';
import { ContactController } from '../../contact/contact.controller.js';
import { HealthController } from '../../health.controller.js';
import { AuthenticationGuard } from '../authorization.guard.js';
import { AUTHORIZATION_PUBLIC, Public, RequireAppRole } from '../authorization.decorators.js';
import {
    IDENTITY_AUTHORIZATION,
    SSE_AUTHORIZATION_RECHECK_MILLISECONDS,
    type AppRole,
    type IdentityAuthorizationBoundary,
    type IdentitySessionResolution,
} from '../authorization.types.js';

const principals: Readonly<Record<string, AppRole>> = {
    admin: 'APP_ADMIN',
    user: 'USER',
};
const suspendedCredentials = new Set<string>();
const boundaryEvents = new BehaviorSubject({ data: 'ready' });

let logOutput = '';
const logDestination = new Writable({
    write(chunk, _encoding, callback) {
        logOutput += chunk.toString();
        callback();
    },
});
const logger = createLogger({ environment: 'test', service: 'api', destination: logDestination });

const identity: IdentityAuthorizationBoundary = {
    async resolveSession(headers): Promise<IdentitySessionResolution> {
        const credential = headers.authorization?.replace('Bearer ', '') ?? '';
        if (suspendedCredentials.has(credential)) {
            return { authorized: false, reason: 'inactive_user' };
        }
        const appRole = principals[credential];
        if (appRole) {
            return {
                authorized: true,
                principal: {
                    appRole,
                    sessionId: `session-${credential}`,
                    userId: `user-${credential}`,
                },
            };
        }
        return {
            authorized: false,
            reason:
                credential === 'unavailable'
                    ? 'service_unavailable'
                    : credential === 'suspended'
                      ? 'inactive_user'
                      : 'invalid_session',
        };
    },
};

@Controller('boundary')
class BoundaryController {
    @Get('rest')
    rest() {
        return { boundary: 'rest' };
    }

    @Sse('events')
    events() {
        return boundaryEvents;
    }

    @Get('files/:fileId')
    @Header('content-type', 'application/octet-stream')
    file() {
        return 'private file';
    }

    @Get('admin')
    @RequireAppRole('APP_ADMIN')
    admin() {
        return { projection: 'admin' };
    }

    @Get('public')
    @Public()
    publicRoute() {
        return { boundary: 'public' };
    }
}

@Module({
    controllers: [BoundaryController],
    providers: [
        { provide: APPLICATION_LOGGER, useValue: logger satisfies ApplicationLogger },
        { provide: IDENTITY_AUTHORIZATION, useValue: identity },
        { provide: SSE_AUTHORIZATION_RECHECK_MILLISECONDS, useValue: 20 },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
    ],
})
class BoundaryModule {}

function openEventStream(baseUrl: string, credential: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
        const outgoing = request(
            `${baseUrl}/boundary/events`,
            {
                headers: { authorization: `Bearer ${credential}` },
            },
            resolve,
        );
        outgoing.once('error', reject);
        outgoing.end();
    });
}

describe('deny-by-default authentication guard', () => {
    let app: Awaited<ReturnType<typeof NestFactory.create>>;
    let baseUrl: string;

    beforeAll(async () => {
        app = await NestFactory.create(BoundaryModule, { logger: false });
        app.useGlobalFilters(new ApiExceptionFilter(logger));
        await app.listen(0, '127.0.0.1');
        const address = (app.getHttpServer() as Server).address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        boundaryEvents.complete();
        await app.close();
    });

    it.each([
        ['REST', '/boundary/rest'],
        ['SSE', '/boundary/events'],
        ['file', '/boundary/files/private-file'],
        ['App Admin', '/boundary/admin'],
    ])('denies forged sessions at the %s boundary', async (_name, pathname) => {
        const response = await fetch(`${baseUrl}${pathname}`, {
            headers: { authorization: 'Bearer forged-private-token' },
        });

        expect(response.status).toBe(401);
        expect(await response.text()).not.toContain('forged-private-token');
    });

    it.each(['expired', 'revoked', 'suspended'])('denies a %s session', async (credential) => {
        const response = await fetch(`${baseUrl}/boundary/rest`, {
            headers: { authorization: `Bearer ${credential}` },
        });
        expect(response.status).toBe(401);
    });

    it('returns service unavailable when authoritative session resolution fails', async () => {
        const response = await fetch(`${baseUrl}/boundary/rest`, {
            headers: { authorization: 'Bearer unavailable' },
        });
        expect(response.status).toBe(503);
    });

    it('allows only APP_ADMIN to receive the App Admin projection', async () => {
        const denied = await fetch(`${baseUrl}/boundary/admin`, {
            headers: { authorization: 'Bearer user' },
        });
        const allowed = await fetch(`${baseUrl}/boundary/admin`, {
            headers: { authorization: 'Bearer admin' },
        });

        expect(denied.status).toBe(403);
        expect(await denied.text()).not.toContain('admin');
        expect(allowed.status).toBe(200);
        await expect(allowed.json()).resolves.toEqual({ projection: 'admin' });
    });

    it('disconnects an established SSE stream after its User is suspended', async () => {
        const stream = await openEventStream(baseUrl, 'user');
        expect(stream.statusCode).toBe(200);
        stream.resume();

        const disconnected = new Promise<void>((resolve) => {
            stream.once('end', resolve);
            stream.once('close', resolve);
        });
        suspendedCredentials.add('user');
        try {
            await expect(
                Promise.race([
                    disconnected.then(() => true),
                    new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
                ]),
            ).resolves.toBe(true);
        } finally {
            suspendedCredentials.delete('user');
            stream.destroy();
        }
    });

    it('requires an explicit public marker and keeps denial logs credential-free', async () => {
        const response = await fetch(`${baseUrl}/boundary/public`);

        expect(response.status).toBe(200);
        expect(logOutput).toContain('"event":"auth.access.denied"');
        expect(logOutput).not.toContain('forged-private-token');
        expect(logOutput).not.toContain('user-user');
        expect(logOutput).not.toContain('session-user');
    });

    it('marks only the existing public controller methods as public', () => {
        expect(Reflect.getMetadata(AUTHORIZATION_PUBLIC, AppController)).toBeUndefined();
        expect(Reflect.getMetadata(AUTHORIZATION_PUBLIC, ContactController)).toBeUndefined();
        expect(Reflect.getMetadata(AUTHORIZATION_PUBLIC, HealthController)).toBeUndefined();
        expect(Reflect.getMetadata(AUTHORIZATION_PUBLIC, AppController.prototype.status)).toBe(
            true,
        );
        expect(Reflect.getMetadata(AUTHORIZATION_PUBLIC, ContactController.prototype.submit)).toBe(
            true,
        );
        expect(Reflect.getMetadata(AUTHORIZATION_PUBLIC, HealthController.prototype.liveness)).toBe(
            true,
        );
        expect(
            Reflect.getMetadata(AUTHORIZATION_PUBLIC, HealthController.prototype.readiness),
        ).toBe(true);
    });
});
