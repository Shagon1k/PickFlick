import { createDatabaseClient } from '@pickflick/database';

import { createAuth } from '../../modules/auth/auth.config.js';
import { loadIntegrationEnvironment } from '../integration.js';
import { connectJourneyBackend } from '../journeys.js';

describe('connectJourneyBackend', () => {
    const environment = loadIntegrationEnvironment();
    const prisma = createDatabaseClient(environment.databaseUrl);
    const key = '127.0.0.1|/get-session';

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('should refuse to clear counters outside the test environment', async () => {
        await prisma.authRateLimit.upsert({
            where: { key },
            create: { key, count: 1, lastRequest: BigInt(Date.now()) },
            update: { count: 1 },
        });
        vi.stubEnv('APP_ENV', 'local');
        try {
            await expect(connectJourneyBackend()).rejects.toThrow(
                'Browser journeys require APP_ENV=test.',
            );
            expect(await prisma.authRateLimit.findUnique({ where: { key } })).toMatchObject({
                count: 1,
            });
        } finally {
            vi.unstubAllEnvs();
            await prisma.authRateLimit.deleteMany({ where: { key } });
        }
    });

    it('should isolate inherited auth counters while keeping session rate limits enforced', async () => {
        let backend = await connectJourneyBackend();
        const userId = await backend.createUser('Isolated journey');
        try {
            const cookies = await backend.cookiesFor(userId, '127.0.0.1');
            const auth = createAuth(environment, prisma);
            const checkSession = () =>
                auth.handler(
                    new Request(`${environment.auth.baseUrl}/api/auth/get-session`, {
                        headers: {
                            cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
                            'x-forwarded-for': '127.0.0.1',
                        },
                    }),
                );
            const counter = { count: 60, lastRequest: BigInt(Date.now()) };
            await prisma.authRateLimit.upsert({
                where: { key },
                create: { key, ...counter },
                update: counter,
            });
            expect((await checkSession()).status).toBe(429);

            await backend.close();
            backend = await connectJourneyBackend();

            expect(await prisma.authRateLimit.findUnique({ where: { key } })).toBeNull();
            const response = await checkSession();
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({ user: { id: userId } });
        } finally {
            await prisma.user.delete({ where: { id: userId } });
            await prisma.authRateLimit.deleteMany({ where: { key } });
            await backend.close();
        }
    });
});
