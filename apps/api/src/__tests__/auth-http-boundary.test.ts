import { request } from 'node:http';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RuntimeEnvironment } from '@pickflick/config/environment';
import { createLogger } from '@pickflick/observability';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { ClubRepository, PrismaClubRepository } from '../clubs/club.repository.js';
import { ClubTierResolver, StaticClubTierResolver } from '../clubs/club-tiers.js';
import { ClubsModule } from '../clubs/clubs.module.js';
import { configureApplication } from '../configure-application.js';
import { ContactModule } from '../contact/contact.module.js';
import {
    ContactMessageRepository,
    PrismaContactMessageRepository,
} from '../contact/contact.repository.js';
import { DatabaseService } from '../database/database.service.js';
import { isAllowedAuthRequest } from '../identity/auth-http.js';
import { IdentityModule } from '../identity/identity.module.js';
import { IdentityService } from '../identity/identity.service.js';

const environment = {
    appEnvironment: 'test',
    apiHost: '127.0.0.1',
    apiPort: 3001,
    shutdownTimeoutMilliseconds: 10_000,
    databaseUrl: 'postgresql://pickflick:synthetic@127.0.0.1:5432/pickflick_test',
    redisUrl: 'redis://127.0.0.1:6379/0',
    storage: {
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        bucket: 'pickflick-test',
        accessKey: 'synthetic',
        secretKey: 'synthetic',
        forcePathStyle: true,
    },
    resend: {
        apiKey: 'local-disabled',
        from: 'PickFlick <pickflick@example.invalid>',
        deliveryMode: 'disabled',
        deliveryEnabled: false,
    },
    contact: {
        deliveryTo: 'contact@example.invalid',
        hashSecret: 'synthetic-contact-secret-at-least-32',
    },
    auth: {
        baseUrl: 'http://127.0.0.1:3000',
        secret: 'synthetic-auth-secret-at-least-32-characters',
        appleSignInEnabled: false,
        appleClientId: 'synthetic-apple-client-id',
        appleKeyId: 'SYNTHKEY1',
        applePrivateKey: 'local-synthetic-apple-private-key',
        appleTeamId: 'SYNTHTEAM1',
        googleClientId: 'synthetic-google-client-id',
        googleClientSecret: 'synthetic-google-client-secret',
        secureCookies: false,
    },
} as const satisfies RuntimeEnvironment;

const logger = createLogger({ environment: 'test', service: 'api' });
let app: NestExpressApplication;
let baseUrl: string;

function sendChunkedBody(
    pathname: string,
    contentType: string,
    body: string,
): Promise<number | undefined> {
    const target = new URL(pathname, baseUrl);

    return new Promise((resolve, reject) => {
        const outgoing = request(
            target,
            {
                headers: {
                    'content-type': contentType,
                    origin: environment.auth.baseUrl,
                },
                method: 'POST',
            },
            (incoming) => {
                incoming.resume();
                incoming.on('end', () => resolve(incoming.statusCode));
            },
        );
        outgoing.on('error', reject);
        outgoing.end(body);
    });
}

beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(
        AppModule.register(environment, logger),
        {
            bodyParser: false,
            logger: false,
        },
    );
    configureApplication(app, logger);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
});

afterAll(async () => {
    await app.close();
});

describe('authentication HTTP boundary', () => {
    it('composes feature-owned providers around one database client', () => {
        const database = app.get(DatabaseService);
        const clubs = app.select(ClubsModule);
        const contact = app.select(ContactModule);
        const identity = app.select(IdentityModule);
        const clubRepository = clubs.get(ClubRepository, { strict: true });
        const contactRepository = contact.get(ContactMessageRepository, { strict: true });
        const identityService = identity.get(IdentityService, { strict: true });

        expect(clubRepository).toBeInstanceOf(PrismaClubRepository);
        expect(clubs.get(ClubTierResolver, { strict: true })).toBeInstanceOf(
            StaticClubTierResolver,
        );
        expect(contactRepository).toBeInstanceOf(PrismaContactMessageRepository);
        expect((clubRepository as unknown as { database: DatabaseService }).database).toBe(
            database,
        );
        expect((contactRepository as unknown as { database: DatabaseService }).database).toBe(
            database,
        );
        expect((identityService as unknown as { database: unknown }).database).toBe(
            database.client,
        );
    });

    it.each(['application/json', 'application/octet-stream'])(
        'rejects a chunked %s authentication body above 100 KB with 413',
        async (contentType) => {
            const status = await sendChunkedBody(
                '/api/auth/sign-in/social',
                contentType,
                JSON.stringify({
                    callbackURL: '/app',
                    padding: 'x'.repeat(100 * 1024),
                    provider: 'google',
                }),
            );

            expect(status).toBe(413);
        },
    );

    it('keeps the reviewed session-read route in the allowlist', () => {
        expect(isAllowedAuthRequest('GET', '/api/auth/get-session')).toBe(true);
    });

    it('keeps explicit identity linking in the reviewed allowlist', () => {
        expect(isAllowedAuthRequest('POST', '/api/auth/link-social')).toBe(true);
        expect(isAllowedAuthRequest('GET', '/api/auth/list-accounts')).toBe(true);
        expect(isAllowedAuthRequest('POST', '/api/auth/unlink-account')).toBe(true);
    });

    it('exposes the Apple callback only when Apple Sign In is enabled', async () => {
        expect(isAllowedAuthRequest('POST', '/api/auth/callback/apple')).toBe(false);
        expect(isAllowedAuthRequest('GET', '/api/auth/callback/apple', true)).toBe(true);

        const response = await fetch(new URL('/api/auth/callback/apple', baseUrl), {
            body: new URLSearchParams({ code: 'synthetic', state: 'synthetic' }),
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            method: 'POST',
        });
        expect(response.status).toBe(404);
    });

    it('returns 404 for an unsupported account mutation', async () => {
        const response = await fetch(new URL('/api/auth/update-user', baseUrl), {
            body: '{}',
            headers: { 'content-type': 'application/json', origin: environment.auth.baseUrl },
            method: 'POST',
        });

        expect(response.status).toBe(404);
    });
});
