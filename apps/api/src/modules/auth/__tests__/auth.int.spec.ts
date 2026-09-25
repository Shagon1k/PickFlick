import type { IncomingMessage, ServerResponse } from 'node:http';

import { Test } from '@nestjs/testing';
import type { BetterAuthPlugin } from 'better-auth';
import { testUtils } from 'better-auth/plugins';

import { RuntimeModule } from '../../../config/runtime.module.js';
import { DatabaseModule } from '../../../database/database.module.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { createUser, integrationEnvironment, removeUsers } from '../../../testing/integration.js';
import { AUTH_PLUGINS, AuthService } from '../auth.service.js';

interface ITestLogin {
    headers: Headers;
    token: string;
}

describe('AuthService', () => {
    const environment = integrationEnvironment();
    let service: AuthService;
    let prisma: PrismaService;
    let login: (userId: string) => Promise<ITestLogin>;
    const userIds: string[] = [];

    const headersOf = (login: ITestLogin): Record<string, string> =>
        Object.fromEntries(login.headers.entries());

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [RuntimeModule.register(environment), DatabaseModule],
            providers: [
                AuthService,
                // Better Auth types its test plugin more loosely than BetterAuthPlugin.
                { provide: AUTH_PLUGINS, useValue: [testUtils() as BetterAuthPlugin] },
            ],
        }).compile();
        service = moduleRef.get(AuthService);
        prisma = moduleRef.get(PrismaService);
        const context = (await service.auth.$context) as unknown as {
            test: { login(input: { userId: string }): Promise<ITestLogin> };
        };
        login = (userId) => context.test.login({ userId });
    });

    afterAll(async () => {
        await removeUsers(prisma, userIds);
        await prisma.$disconnect();
    });

    async function user(status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE'): Promise<string> {
        const id = await createUser(prisma, { status });
        userIds.push(id);
        return id;
    }

    describe('when starting a social sign-in', () => {
        const signIn = (callbackURL: string) =>
            service.auth.handler(
                new Request(`${environment.auth.baseUrl}/api/auth/sign-in/social`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        origin: environment.auth.baseUrl,
                    },
                    body: JSON.stringify({ provider: 'google', callbackURL }),
                }),
            );

        it('should send an allowed return target to Google', async () => {
            const response = await signIn('/clubs/new');
            const body = (await response.json()) as { url?: string };

            expect(response.status).toBe(200);
            expect(new URL(body.url ?? '').hostname).toBe('accounts.google.com');
        });

        it('should reject a return target outside the allowlist', async () => {
            expect((await signIn('https://evil.example/app')).status).toBe(400);
        });
    });

    describe('when resolving a session', () => {
        it('should return the signed-in User', async () => {
            const userId = await user();
            const session = await login(userId);

            await expect(service.resolveUser(headersOf(session))).resolves.toMatchObject({
                id: userId,
                appRole: 'USER',
            });
        });

        it('should ignore a forged cookie', async () => {
            await expect(
                service.resolveUser({ cookie: 'pickflick.session_token=forged.value' }),
            ).resolves.toBeNull();
        });

        it('should sign a suspended User out everywhere', async () => {
            const userId = await user();
            const session = await login(userId);
            await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

            await expect(service.resolveUser(headersOf(session))).resolves.toBeNull();
            expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
        });

        it('should refuse to create a session for a suspended User', async () => {
            const userId = await user('SUSPENDED');

            await expect(login(userId)).rejects.toThrow();
            expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
        });
    });

    describe('when signing out', () => {
        it('should revoke the session', async () => {
            const userId = await user();
            const session = await login(userId);

            const response = await service.auth.handler(
                new Request(`${environment.auth.baseUrl}/api/auth/sign-out`, {
                    method: 'POST',
                    headers: { ...headersOf(session), origin: environment.auth.baseUrl },
                }),
            );

            expect(response.status).toBe(200);
            await expect(service.resolveUser(headersOf(session))).resolves.toBeNull();
        });
    });

    describe('when mounting the handler', () => {
        it('should answer 404 for a Better Auth route PickFlick does not expose', async () => {
            const response = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };

            await service.handler(
                {
                    method: 'POST',
                    url: '/api/auth/update-user',
                    headers: {},
                } as unknown as IncomingMessage,
                response as unknown as ServerResponse,
            );

            expect(response.statusCode).toBe(404);
        });
    });
});
