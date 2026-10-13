import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { loadRuntimeEnvironment, type TRuntimeEnvironment } from '@pickflick/config/environment';
import {
    assertSafeSeedOrResetTarget,
    type Prisma,
    type PrismaClient,
    snapshotSessionSettings,
} from '@pickflick/database';

import { AppModule } from '../app.module.js';
import { configureApplication } from '../config/configure-application.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from '../modules/auth/auth.service.js';
import type { IAuthUser } from '../modules/auth/auth.types.js';
import { type IStoredObject, StorageService } from '../modules/storage/storage.service.js';

/** Loads the local or test environment and refuses to run against any other database. */
export function integrationEnvironment(): TRuntimeEnvironment {
    const environment = loadRuntimeEnvironment();
    assertSafeSeedOrResetTarget(environment);
    return environment;
}

export async function createUser(
    prisma: PrismaClient,
    overrides: { status?: 'ACTIVE' | 'SUSPENDED' } = {},
): Promise<string> {
    const id = randomUUID();
    await prisma.user.create({
        data: {
            id,
            email: `it-${id}@example.invalid`,
            emailVerified: true,
            displayName: 'Test User',
            ...overrides,
        },
    });
    return id;
}

/** Adds an active Membership and returns its ID. */
export async function addMember(
    prisma: PrismaClient,
    clubId: string,
    userId: string,
    role: 'ADMIN' | 'MODERATOR' | 'MEMBER' = 'MEMBER',
): Promise<string> {
    const membership = await prisma.membership.create({
        data: { id: randomUUID(), clubId, userId, role },
    });
    return membership.id;
}

/** Creates a Session with the Club's current settings snapshot; `data` overrides any column. */
export async function createSession(
    prisma: PrismaClient,
    clubId: string,
    data: Partial<Prisma.SessionUncheckedCreateInput> &
        Pick<Prisma.SessionUncheckedCreateInput, 'type' | 'phase'>,
) {
    return prisma.session.create({
        data: {
            id: randomUUID(),
            clubId,
            ...(await snapshotSessionSettings(prisma, clubId)),
            ...data,
        },
    });
}

/** Removes the users and every Club, Membership, Session, and audit row tied to them. */
export async function removeUsers(prisma: PrismaClient, userIds: string[]): Promise<void> {
    const memberships = await prisma.membership.findMany({
        where: { userId: { in: userIds } },
        select: { clubId: true },
    });
    const clubIds = [...new Set(memberships.map(({ clubId }) => clubId))];
    await prisma.clubInvite.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.clubAuditEvent.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.sessionInvite.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.nomination.deleteMany({ where: { session: { clubId: { in: clubIds } } } });
    await prisma.sessionParticipant.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.nominationDeadlineNotification.deleteMany({
        where: { decision: { session: { clubId: { in: clubIds } } } },
    });
    await prisma.nominationDeadlineDecision.deleteMany({
        where: { session: { clubId: { in: clubIds } } },
    });
    await prisma.session.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.membership.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

class MemoryStorage {
    readonly objects = new Map<string, IStoredObject>();

    async put(key: string, body: Buffer, contentType: string): Promise<void> {
        this.objects.set(key, { body, contentType });
    }

    async get(key: string): Promise<IStoredObject | null> {
        return this.objects.get(key) ?? null;
    }

    async delete(key: string): Promise<void> {
        this.objects.delete(key);
    }

    async ping(): Promise<void> {}
}

export interface ITestApi {
    prisma: PrismaService;
    storage: MemoryStorage;
    /** Calls the API as a User; the `x-test-user` header stands in for a session cookie. */
    request(
        path: string,
        init?: RequestInit & { userId?: string; json?: unknown },
    ): Promise<Response>;
    close(): Promise<void>;
}

/**
 * Boots the real application against the local database. Storage lives in memory and the
 * session lookup trusts `x-test-user`; auth itself has its own integration test.
 */
export async function startTestApi(): Promise<ITestApi> {
    const storage = new MemoryStorage();
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule.register(integrationEnvironment())],
    })
        .overrideProvider(StorageService)
        .useValue(storage)
        .overrideProvider(AuthService)
        .useValue({
            handler: () => undefined,
            resolveUser: async (headers: Record<string, unknown>): Promise<IAuthUser | null> => {
                const id = headers['x-test-user'];
                return typeof id === 'string'
                    ? { id, appRole: 'USER', sessionId: `session-${id}` }
                    : null;
            },
        })
        .compile();

    const app = moduleRef.createNestApplication<NestExpressApplication>({
        bodyParser: false,
        logger: false,
    });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;

    return {
        prisma: app.get(PrismaService),
        storage,
        request: (path, { userId, json, headers, ...init } = {}) =>
            fetch(`http://127.0.0.1:${port}${path}`, {
                ...init,
                headers: {
                    ...(userId ? { 'x-test-user': userId } : {}),
                    ...(json === undefined ? {} : { 'content-type': 'application/json' }),
                    ...headers,
                },
                ...(json === undefined ? {} : { body: JSON.stringify(json) }),
            }),
        close: () => app.close(),
    };
}
