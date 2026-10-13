import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { snapshotSessionSettings } from '@pickflick/database';
import type { BetterAuthOptions } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import type { Request, Response } from 'express';

import { AppModule } from '../app.module.js';
import { configureApplication } from '../config/configure-application.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { EMAIL_CLIENT } from '../modules/email/email.types.js';
import { type IMovieProvider, MOVIE_PROVIDER } from '../modules/movies/providers/movie-provider.js';
import { StorageService } from '../modules/storage/storage.service.js';
import { createUser, integrationEnvironment, MemoryStorage, removeUsers } from './integration.js';
import { movieDetails } from './movie-fixtures.js';

const environment = integrationEnvironment();
const users: string[] = [];
const provider: IMovieProvider = {
    configurationKey: 'ui-synthetic-provider',
    search: async () => ({
        movies: [movieDetails(172, new Date().toISOString())],
        page: 1,
        totalPages: 1,
        totalResults: 1,
    }),
    details: async () => movieDetails(172, new Date().toISOString()),
};
const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(environment)] })
    .overrideProvider(StorageService)
    .useValue(new MemoryStorage())
    .overrideProvider(EMAIL_CLIENT)
    .useValue({ send: async () => undefined })
    .overrideProvider(MOVIE_PROVIDER)
    .useValue(provider)
    .overrideProvider(AuthService)
    .useFactory({
        inject: [PrismaService],
        factory: (prisma: PrismaService) => {
            const service = new AuthService(environment, prisma, [testUtils()]);
            // Browser tests share a loopback peer and exceed a human's session-read rate.
            const rateLimit: NonNullable<BetterAuthOptions['rateLimit']> =
                service.auth.options.rateLimit;
            rateLimit.customRules = { ...rateLimit.customRules, '/get-session': false };
            return service;
        },
    })
    .compile();
const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
});
configureApplication(app, false);
const prisma = app.get(PrismaService);
const authContext = (await app.get(AuthService).auth.$context) as unknown as {
    test: { login(input: { userId: string }): Promise<{ headers: Headers }> };
};
async function signIn(userId: string, response: Response) {
    const login = await authContext.test.login({ userId });
    response.setHeader(
        'set-cookie',
        `${login.headers.get('cookie')!}; Path=/; HttpOnly; SameSite=Lax`,
    );
}
// These loopback fixture routes exist only in this test entry point, never in AppModule.
app.getHttpAdapter()
    .getInstance()
    .post('/_test/fixtures', async (request: Request, response: Response) => {
        const admin = await createUser(prisma);
        const member = await createUser(prisma);
        const outsider = await createUser(prisma);
        users.push(admin, member, outsider);
        await prisma.user.update({ where: { id: admin }, data: { displayName: 'Avery Admin' } });
        await prisma.user.update({ where: { id: member }, data: { displayName: 'Morgan Member' } });
        const clubId = randomUUID();
        await prisma.club.create({
            data: { id: clubId, name: 'Midnight Society', selectionScaleMax: 7 },
        });
        const adminMembershipId = randomUUID();
        const memberMembershipId = randomUUID();
        await prisma.membership.createMany({
            data: [
                { id: adminMembershipId, clubId, userId: admin, role: 'ADMIN' },
                { id: memberMembershipId, clubId, userId: member, role: 'MEMBER' },
            ],
        });
        let sessionId: string | null = null;
        if ((request.body as { session?: boolean }).session) {
            sessionId = randomUUID();
            await prisma.session.create({
                data: {
                    id: sessionId,
                    clubId,
                    type: 'FULL_CYCLE',
                    phase: 'NOMINATION',
                    topic: 'Noir night',
                    location: 'Room A',
                    ...(await snapshotSessionSettings(prisma, clubId)),
                    showNominationsBeforeSubmit: false,
                    showNominationAuthors: false,
                },
            });
            await prisma.sessionParticipant.create({
                data: {
                    id: randomUUID(),
                    sessionId,
                    clubId,
                    membershipId: adminMembershipId,
                    status: 'ACCEPTED',
                },
            });
        }
        await signIn(admin, response);
        response.json({ clubId, sessionId, admin, member, outsider, memberMembershipId });
    });
app.getHttpAdapter()
    .getInstance()
    .post('/_test/login/:userId', async (request: Request, response: Response) => {
        const userId = request.params.userId as string;
        if (!users.includes(userId)) {
            response.sendStatus(404);
            return;
        }
        await signIn(userId, response);
        response.sendStatus(204);
    });
await app.listen(environment.backendPort, '127.0.0.1');
const web = spawn(process.execPath, ['apps/frontend/.next/standalone/apps/frontend/server.js'], {
    env: {
        ...process.env,
        HOSTNAME: '127.0.0.1',
    },
    stdio: 'inherit',
});
let shutdown: Promise<void> | undefined;
function stop() {
    shutdown ??= (async () => {
        web.kill('SIGTERM');
        try {
            await removeUsers(prisma, users);
        } finally {
            await app.close();
        }
    })();
    return shutdown;
}
process.once('SIGINT', () => {
    void stop();
});
process.once('SIGTERM', () => {
    void stop();
});
web.once('exit', (code) => {
    process.exitCode = code ?? 1;
    void stop();
});
