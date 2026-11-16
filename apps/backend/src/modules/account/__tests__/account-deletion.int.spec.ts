import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { testUtils } from 'better-auth/plugins';

import { AppModule } from '../../../app.module.js';
import { configureApplication } from '../../../config/configure-application.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
    addMember,
    createSession,
    createUser,
    loadIntegrationEnvironment,
    withFailingInsert,
} from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';
import { AuthService } from '../../auth/auth.service.js';
import { claimExport, getExportObjectKey } from '../../data-exports/data-export-store.js';
import { DataExportWorkerService } from '../../data-exports/data-export-worker.service.js';
import { DataExportsService } from '../../data-exports/data-exports.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { AccountDeletionService } from '../account-deletion.service.js';
import { AccountDeletionWorkerService } from '../account-deletion-worker.service.js';

interface ILogin {
    headers: Headers;
}

describe('AccountDeletionController and worker', () => {
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let auth: AuthService;
    let worker: AccountDeletionWorkerService;
    let exports: DataExportsService;
    let service: AccountDeletionService;
    let login: (userId: string) => Promise<ILogin>;
    let baseUrl: string;
    let owner: string;
    let peer: string;
    let clubId: string;
    let movieId: string;
    let sessionId: string;
    let ownerMember: string;
    let initial: ILogin;
    let reauthenticated: ILogin;
    const objects = new Map<string, Buffer>();
    const storage = {
        put: vi.fn(async (key: string, body: Buffer) => {
            objects.set(key, body);
        }),
        get: vi.fn(async (key: string) =>
            objects.has(key) ? { body: objects.get(key)!, contentType: 'application/gzip' } : null,
        ),
        delete: vi.fn(async (key: string) => {
            objects.delete(key);
        }),
        ping: vi.fn(async () => undefined),
    };
    const request = (path: string, session?: ILogin, json?: unknown) =>
        fetch(`${baseUrl}${path}`, {
            method: json === undefined ? 'GET' : 'POST',
            headers: {
                ...Object.fromEntries(session?.headers.entries() ?? []),
                'content-type': 'application/json',
            },
            body: json === undefined ? undefined : JSON.stringify(json),
        });
    const accept = (session = reauthenticated, json: unknown = { confirmation: 'DELETE' }) =>
        request('/account/deletion', session, json);
    const getJob = () => prisma.accountDeletion.findUniqueOrThrow({ where: { userId: owner } });
    const sweep = (offset = 0) => worker.sweep(new Date(Date.now() + offset));
    async function prepare() {
        expect((await request('/account/deletion/reauth', initial, {})).status).toBe(204);
        // Keep timestamp ordering deterministic without sleeps; the real new session is still required.
        await prisma.accountDeletion.update({
            where: { userId: owner },
            data: { requestedAt: new Date(Date.now() - 1000) },
        });
        reauthenticated = await login(owner);
    }
    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule.register(loadIntegrationEnvironment())],
        })
            .overrideProvider(StorageService)
            .useValue(storage)
            .overrideProvider(AuthService)
            .useFactory({
                factory: (database: PrismaService) =>
                    new AuthService(loadIntegrationEnvironment(), database, [testUtils()]),
                inject: [PrismaService],
            })
            .compile();
        app = moduleRef.createNestApplication<NestExpressApplication>({
            bodyParser: false,
            rawBody: true,
            logger: false,
        });
        configureApplication(app);
        await app.listen(0, '127.0.0.1');
        baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
        prisma = app.get(PrismaService);
        auth = app.get(AuthService);
        worker = app.get(AccountDeletionWorkerService);
        exports = app.get(DataExportsService);
        service = app.get(AccountDeletionService);
        await worker.onModuleDestroy();
        await app.get(DataExportWorkerService).onModuleDestroy();
        const context = (await auth.auth.$context) as unknown as {
            test: { login(input: { userId: string }): Promise<ILogin> };
        };
        login = (userId) => context.test.login({ userId });
    });
    beforeEach(async () => {
        [owner, peer] = await Promise.all([createUser(prisma), createUser(prisma)]);
        clubId = randomUUID();
        movieId = randomUUID();
        await prisma.club.create({ data: { id: clubId, name: 'Deletion test Club' } });
        ownerMember = await addMember(prisma, clubId, owner, 'ADMIN');
        await addMember(prisma, clubId, peer, 'MODERATOR');
        await prisma.movie.create({ data: { id: movieId, title: 'Preserved Movie' } });
        const session = await createSession(prisma, clubId, {
            type: 'FULL_CYCLE',
            phase: 'RATING',
            movieId,
        });
        sessionId = session.id;
        const participant = await prisma.sessionParticipant.create({
            data: { sessionId, clubId, membershipId: ownerMember, status: 'ACCEPTED' },
        });
        const nomination = await prisma.nomination.create({
            data: { sessionId, participantId: participant.id, movieId, isInSelection: true },
        });
        await prisma.selectionBallot.create({
            data: {
                sessionId,
                participantId: participant.id,
                scores: { create: { nominationId: nomination.id, score: 3 } },
            },
        });
        await prisma.sessionRating.create({
            data: {
                sessionId,
                participantId: participant.id,
                score: 8,
                comment: 'Keep this shared comment.',
            },
        });
        await prisma.session.update({
            where: { id: sessionId },
            data: {
                phase: 'COMPLETED',
                selectionResult: {
                    movieId,
                    winnerNominationId: nomination.id,
                    closedAt: new Date().toISOString(),
                    closure: { kind: 'AUTOMATIC' },
                    reason: 'ONLY_NOMINATION',
                    inputs: {
                        scaleMin: 0,
                        scaleMax: 5,
                        nominations: [{ id: nomination.id, movieId }],
                        ballots: [
                            {
                                participantId: participant.id,
                                scores: [{ nominationId: nomination.id, score: 3 }],
                            },
                        ],
                    },
                    ranking: [
                        {
                            id: nomination.id,
                            movieId,
                            total: 3,
                            maximumCount: 0,
                            supporterCount: 1,
                        },
                    ],
                },
            },
        });
        await prisma.personalMovieRating.createMany({
            skipDuplicates: true,
            data: [owner, peer].map((userId) => ({
                userId,
                movieId,
                score: 7,
                source: 'PERSONAL',
            })),
        });
        await prisma.watchlistItem.createMany({
            data: [owner, peer].map((userId) => ({ userId, movieId, priority: 'HIGH' })),
        });
        await prisma.providerAccount.create({
            data: { userId: owner, provider: 'google', providerSubject: randomUUID() },
        });
        initial = await login(owner);
        objects.clear();
        storage.delete.mockClear();
    });
    afterEach(async () => {
        storage.delete.mockReset().mockImplementation(async (key: string) => {
            objects.delete(key);
        });
        await prisma.dataExportObject.deleteMany({ where: { job: { userId: owner } } });
        await prisma.dataExportJob.deleteMany({ where: { userId: owner } });
        await prisma.accountDeletion.deleteMany({ where: { userId: owner } });
        await removeUsers(prisma, [owner, peer]);
        await prisma.movie.delete({ where: { id: movieId } });
        await prisma.accountAvatarObject.deleteMany({
            where: { key: { startsWith: `account-avatars/${owner}` } },
        });
    });
    afterAll(async () => {
        await app.close();
    });

    it('should require a new same-account session after preparation and reject unsafe boundaries', async () => {
        expect(
            (await request('/account/deletion', undefined, { confirmation: 'DELETE' })).status,
        ).toBe(401);
        expect((await accept(initial)).status).toBe(409);
        await prepare();
        expect((await accept(initial)).status).toBe(409);
        expect((await accept(await login(peer))).status).toBe(409);
        expect(
            (await accept(reauthenticated, { confirmation: 'DELETE', userId: peer })).status,
        ).toBe(400);
        expect((await accept(reauthenticated, { confirmation: 'delete' })).status).toBe(400);
        expect(
            (
                await request(`/account/deletion?userId=${peer}`, reauthenticated, {
                    confirmation: 'DELETE',
                })
            ).status,
        ).toBe(400);
        await prisma.authSession.updateMany({
            where: { userId: owner },
            data: { createdAt: new Date(Date.now() - 6 * 60_000) },
        });
        expect((await accept()).status).toBe(409);
        expect((await getJob()).status).toBe('AWAITING_REAUTH');
        expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).status).toBe(
            'ACTIVE',
        );
    });

    it('should atomically revoke all access, preserve shared contributions and notify an adminless Club once', async () => {
        const before = await prisma.session.findUniqueOrThrow({
            where: { id: sessionId },
            include: {
                nominations: true,
                selectionBallots: { include: { scores: true } },
                ratings: true,
                participants: true,
            },
        });
        await prepare();
        const session = await auth.resolveUser(
            Object.fromEntries(reauthenticated.headers.entries()),
        );
        expect(session).not.toBeNull();
        await Promise.all([service.accept(session!), service.accept(session!)]);
        const after = await prisma.session.findUniqueOrThrow({
            where: { id: sessionId },
            include: {
                nominations: true,
                selectionBallots: { include: { scores: true } },
                ratings: true,
                participants: true,
            },
        });
        expect(after).toEqual(before);
        expect(after.ratings[0]?.comment).toBe('Keep this shared comment.');
        const deleted = await prisma.user.findUniqueOrThrow({ where: { id: owner } });
        expect(deleted).toMatchObject({
            status: 'ANONYMIZED',
            displayName: 'Deleted user',
            image: null,
            avatarObjectKey: null,
            emailVerified: false,
            appearance: {},
        });
        expect(deleted.email).toBe(`deleted-${owner}@example.invalid`);
        expect(await prisma.authSession.count({ where: { userId: owner } })).toBe(0);
        expect(await prisma.providerAccount.count({ where: { userId: owner } })).toBe(0);
        expect(await prisma.personalMovieRating.count({ where: { userId: owner } })).toBe(0);
        expect(await prisma.watchlistItem.count({ where: { userId: owner } })).toBe(0);
        expect(await prisma.personalMovieRating.count({ where: { userId: peer } })).toBe(1);
        expect(await prisma.watchlistItem.count({ where: { userId: peer } })).toBe(1);
        expect(
            await prisma.membership.count({ where: { clubId, status: 'ACTIVE', role: 'ADMIN' } }),
        ).toBe(0);
        expect(
            await prisma.clubAuditEvent.count({ where: { clubId, action: 'ACCOUNT_DELETED' } }),
        ).toBe(1);
        expect(
            await prisma.notification.findMany({
                where: { clubId, event: 'CLUB_ADMIN_DELETED' },
                select: { recipientId: true, inApp: true, email: true },
            }),
        ).toEqual([{ recipientId: peer, inApp: true, email: true }]);
        expect((await getJob()).billing).toBe('NOT_IMPLEMENTED');
        expect((await request('/account', initial)).status).toBe(401);
        expect((await request('/account', reauthenticated)).status).toBe(401);
        await expect(login(owner)).rejects.toMatchObject({ body: { code: 'ACCOUNT_INACTIVE' } });
        const peerSession = await login(peer);
        const hub = await request(`/clubs/${clubId}/hub`, peerSession);
        expect(hub.status).toBe(200);
        expect(await hub.text()).toContain('ADMINLESS');
        const history = await request(`/sessions/${sessionId}`, peerSession);
        expect(history.status).toBe(200);
        const content = await history.text();
        expect(content).toContain('Deleted user');
        expect(content).toContain('Keep this shared comment.');
        expect(
            (
                await request(`/clubs/${clubId}/sessions`, peerSession, {
                    type: 'PRE_SELECTED',
                    movieId,
                    location: 'Room',
                    scheduledAt: new Date(Date.now() + 60_000).toISOString(),
                    deadlineAt: null,
                })
            ).status,
        ).toBe(409);
        await sweep();
        expect((await getJob()).status).toBe('COMPLETE');
        await sweep(60_000);
        expect((await getJob()).status).toBe('COMPLETE');
    });

    it('should complete an open Rating after the last non-submitter deletes their account', async () => {
        await prisma.membership.update({ where: { id: ownerMember }, data: { role: 'MEMBER' } });
        await prisma.membership.updateMany({
            where: { clubId, userId: peer },
            data: { role: 'ADMIN' },
        });
        const live = await createSession(prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'RATING',
            movieId,
        });
        await prisma.sessionParticipant.create({
            data: { sessionId: live.id, clubId, membershipId: ownerMember, status: 'ACCEPTED' },
        });
        const peerMember = await prisma.membership.findFirstOrThrow({
            where: { clubId, userId: peer },
        });
        const participant = await prisma.sessionParticipant.create({
            data: { sessionId: live.id, clubId, membershipId: peerMember.id, status: 'ACCEPTED' },
        });
        await prisma.sessionRating.create({
            data: {
                sessionId: live.id,
                participantId: participant.id,
                score: 7,
                comment: 'Preserve the peer response.',
            },
        });
        await prepare();
        expect((await accept()).status).toBe(202);
        expect((await prisma.session.findUniqueOrThrow({ where: { id: live.id } })).phase).toBe(
            'COMPLETED',
        );
        expect(
            await prisma.sessionParticipant.findFirst({
                where: { sessionId: live.id, membershipId: ownerMember },
            }),
        ).toMatchObject({ status: 'LEFT' });
        expect(
            await prisma.sessionRating.findFirst({ where: { sessionId: live.id } }),
        ).toMatchObject({ comment: 'Preserve the peer response.' });
        expect(
            await prisma.notification.count({ where: { clubId, event: 'CLUB_ADMIN_DELETED' } }),
        ).toBe(0);
    });

    it('should roll back revocation and job acceptance when a database write fails', async () => {
        await prepare();
        await withFailingInsert(
            prisma,
            'ClubAuditEvent',
            `NEW."actorUserId" = '${owner}'::uuid AND NEW.action = 'ACCOUNT_DELETED'`,
            async () => {
                expect((await accept()).status).toBe(500);
            },
        );
        expect((await getJob()).status).toBe('AWAITING_REAUTH');
        expect((await request('/account', initial)).status).toBe(200);
        expect(
            (await prisma.membership.findUniqueOrThrow({ where: { id: ownerMember } })).status,
        ).toBe('ACTIVE');
        expect((await accept()).status).toBe(202);
    });

    it('should keep durable object intent through partial storage failure and restart', async () => {
        const key = `account-avatars/${owner}.webp`;
        await prisma.accountAvatarObject.create({ data: { key } });
        await prisma.user.update({ where: { id: owner }, data: { avatarObjectKey: key } });
        objects.set(key, Buffer.from('private avatar'));
        const job = await exports.request(owner, randomUUID());
        const exportKey = `data-exports/${job.id}/test.json.gz`;
        await prisma.dataExportObject.create({
            data: { key: exportKey, jobId: job.id, deleteAfter: new Date(Date.now() + 60_000) },
        });
        objects.set(exportKey, Buffer.from('private archive'));
        await prepare();
        expect((await accept()).status).toBe(202);
        storage.delete.mockRejectedValueOnce(new Error('unavailable'));
        await sweep();
        expect((await getJob()).failure).toBe('OBJECT_CLEANUP_FAILED');
        expect((await getJob()).avatarKey).toBe(key);
        expect(objects.has(key)).toBe(true);
        const restarted = new AccountDeletionWorkerService(prisma, app.get(StorageService));
        const later = new Date(Date.now() + 120_000);
        await restarted.sweep(later);
        expect(objects.has(key)).toBe(false);
        expect((await getJob()).status).toBe('PENDING');
        await restarted.sweep(new Date(later.getTime() + 10_000));
        await restarted.sweep(new Date(later.getTime() + 20_000));
        expect((await getJob()).status).toBe('COMPLETE');
        expect(objects.size).toBe(0);
        expect(await prisma.dataExportJob.count({ where: { userId: owner } })).toBe(0);
    });

    it('should wait for in-flight archive upload leases before deleting tracked objects', async () => {
        await exports.request(owner, randomUUID());
        const claim = await claimExport(prisma, new Date());
        expect(claim?.userId).toBe(owner);
        await prepare();
        expect((await accept()).status).toBe(202);
        await sweep();
        expect((await getJob()).status).toBe('PENDING');
        const key = getExportObjectKey(claim!);
        objects.set(key, Buffer.from('late artifact'));
        const afterLease = claim!.leaseUntil!.getTime() + 31_000;
        await worker.sweep(new Date(afterLease));
        await worker.sweep(new Date(afterLease + 10_000));
        expect(objects.has(key)).toBe(false);
        expect((await getJob()).status).toBe('COMPLETE');
    });

    it('should remove a private avatar from real S3-compatible storage before completing', async () => {
        const realStorage = new StorageService(loadIntegrationEnvironment());
        const key = `account-avatars/${owner}-physical.webp`;
        try {
            await realStorage.put(key, Buffer.from('synthetic private avatar'), 'image/webp');
            await prisma.accountAvatarObject.create({ data: { key } });
            await prisma.user.update({ where: { id: owner }, data: { avatarObjectKey: key } });
            expect(await realStorage.exists(key)).toBe(true);
            await prepare();
            expect((await accept()).status).toBe(202);
            const realWorker = new AccountDeletionWorkerService(prisma, realStorage);
            await realWorker.sweep();
            await realWorker.sweep(new Date(Date.now() + 10_000));
            expect(await realStorage.exists(key)).toBe(false);
            expect((await getJob()).status).toBe('COMPLETE');
        } finally {
            await realStorage.delete(key);
        }
    });

    it('should reject private writes from requests that outlive account deletion', async () => {
        await prepare();
        expect((await accept()).status).toBe(202);
        await expect(
            prisma.personalMovieRating.create({
                data: { userId: owner, movieId, score: 9, source: 'PERSONAL' },
            }),
        ).rejects.toThrow();
        await expect(
            prisma.watchlistItem.create({ data: { userId: owner, movieId, priority: 'LOW' } }),
        ).rejects.toThrow();
        await expect(
            prisma.authSession.create({
                data: {
                    userId: owner,
                    token: randomUUID(),
                    expiresAt: new Date(Date.now() + 60_000),
                },
            }),
        ).rejects.toThrow();
        await expect(addMember(prisma, clubId, owner)).rejects.toThrow();
        await expect(
            prisma.user.update({
                where: { id: owner },
                data: { displayName: 'Stale provider name' },
            }),
        ).rejects.toThrow();
        expect(await prisma.personalMovieRating.count({ where: { userId: owner } })).toBe(0);
    });
});
