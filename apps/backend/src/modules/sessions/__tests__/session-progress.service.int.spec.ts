import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { BetterAuthPlugin } from 'better-auth';
import { testUtils } from 'better-auth/plugins';

import { RuntimeModule } from '../../../config/runtime.module.js';
import { DatabaseModule } from '../../../database/database.module.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
    addMember,
    createUser,
    integrationEnvironment,
    removeUsers,
} from '../../../testing/integration.js';
import { AUTH_PLUGINS, AuthService } from '../../auth/auth.service.js';
import { SessionProgressService } from '../session-progress.service.js';

describe('SessionProgressService', () => {
    let prisma: PrismaService;
    let auth: AuthService;
    let progress: SessionProgressService;
    let login: (userId: string) => Promise<{ headers: Headers }>;
    const userIds: string[] = [];
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [RuntimeModule.register(integrationEnvironment()), DatabaseModule],
            providers: [
                AuthService,
                SessionProgressService,
                // Better Auth types its test plugin more loosely than BetterAuthPlugin.
                { provide: AUTH_PLUGINS, useValue: [testUtils() as BetterAuthPlugin] },
            ],
        }).compile();
        prisma = module.get(PrismaService);
        auth = module.get(AuthService);
        progress = module.get(SessionProgressService);
        // The test plugin augments Better Auth's context at runtime.
        const context = (await auth.auth.$context) as unknown as {
            test: { login(input: { userId: string }): Promise<{ headers: Headers }> };
        };
        login = (userId) => context.test.login({ userId });
    });
    afterAll(async () => {
        await removeUsers(prisma, userIds);
        await prisma.$disconnect();
    });
    it.each(['revoked', 'expired', 'suspended'] as const)(
        'should reject the next progress snapshot after authentication is %s',
        async (state) => {
            const userId = await createUser(prisma);
            userIds.push(userId);
            const clubId = randomUUID();
            await prisma.club.create({ data: { id: clubId, name: 'Private stream' } });
            await addMember(prisma, clubId, userId, 'ADMIN');
            const sessionId = randomUUID();
            await prisma.session.create({
                data: {
                    id: sessionId,
                    clubId,
                    type: 'FULL_CYCLE',
                    phase: 'NOMINATION',
                    selectionScaleMin: 0,
                    selectionScaleMax: 10,
                    showNominationAuthors: false,
                    showNominationsBeforeSubmit: false,
                    showVoteResults: false,
                    showRatingResults: false,
                    useMonochromeMedia: false,
                },
            });
            const signedIn = await login(userId);
            const headers = Object.fromEntries(signedIn.headers.entries());
            await expect(progress.snapshot(headers, sessionId)).resolves.toEqual({ version: 1 });
            if (state === 'revoked') await prisma.authSession.deleteMany({ where: { userId } });
            else if (state === 'expired')
                await prisma.authSession.updateMany({
                    where: { userId },
                    data: { expiresAt: new Date(0) },
                });
            else await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
            await expect(progress.snapshot(headers, sessionId)).rejects.toMatchObject({
                status: 401,
            });
        },
    );
});
