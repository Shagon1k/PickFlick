import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { IBillingSummary } from '@pickflick/contracts';
import { testUtils } from 'better-auth/plugins';

import { AppModule } from '../../../app.module.js';
import { configureApplication } from '../../../config/configure-application.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { createUser, loadIntegrationEnvironment } from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';
import { AccountDeletionWorkerService } from '../../account/account-deletion-worker.service.js';
import { AuthService } from '../../auth/auth.service.js';
import { buildArchive } from '../../data-exports/archive.js';
import { DataExportWorkerService } from '../../data-exports/data-export-worker.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { BILLING_PROVIDER, BillingProviderError } from '../billing.types.js';
import { StubBillingProvider } from '../provider/stub-billing.provider.js';

describe('BillingController', () => {
    const provider = new StubBillingProvider(true);
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let baseUrl: string;
    let userId: string;
    let otherId: string;
    let cookie: string;
    let otherCookie: string;
    let login: (userId: string) => Promise<{ headers: Headers }>;
    const request = (path: string, method = 'GET', body?: unknown, token = cookie) =>
        fetch(`${baseUrl}${path}`, {
            method,
            headers: { cookie: token, 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    // Node's Response JSON boundary returns unknown; the API owns this response contract.
    const readSummary = async () => (await (await request('/billing')).json()) as IBillingSummary;
    const checkout = () => request('/billing/checkout', 'POST', {});
    const account = () => prisma.subscription.findUniqueOrThrow({ where: { userId } });

    async function complete(isPaid = true) {
        const row = await account();
        const session = provider.checkouts.get(row.providerCheckoutId!)!;
        session.status = 'complete';
        session.subscriptionId = `subscription_${row.id}`;
        session.url = null;
        provider.subscriptions.set(session.subscriptionId, {
            id: session.subscriptionId,
            customerId: row.providerCustomerId!,
            priceId: 'price_test',
            status: isPaid ? 'ACTIVE' : 'PENDING',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 86400_000),
            paidThrough: isPaid ? new Date(Date.now() + 30 * 86400_000) : null,
            cancelAtPeriodEnd: false,
        });
        return session.subscriptionId;
    }
    beforeAll(async () => {
        const environment = loadIntegrationEnvironment();
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule.register(environment)],
        })
            .overrideProvider(BILLING_PROVIDER)
            .useValue(provider)
            .overrideProvider(AuthService)
            .useFactory({
                factory: (database: PrismaService) =>
                    new AuthService(environment, database, [testUtils()]),
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
        await app.get(AccountDeletionWorkerService).onModuleDestroy();
        await app.get(DataExportWorkerService).onModuleDestroy();
        // Better Auth's test plugin augments context at runtime.
        const context = (await app.get(AuthService).auth.$context) as unknown as {
            test: { login(input: { userId: string }): Promise<{ headers: Headers }> };
        };
        login = (id) => context.test.login({ userId: id });
    });
    beforeEach(async () => {
        userId = await createUser(prisma);
        otherId = await createUser(prisma);
        cookie = (await login(userId)).headers.get('cookie')!;
        otherCookie = (await login(otherId)).headers.get('cookie')!;
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        await prisma.billingAuditEvent.deleteMany({
            where: { subscription: { userId: { in: [userId, otherId] } } },
        });
        await prisma.subscription.deleteMany({ where: { userId: { in: [userId, otherId] } } });
        await prisma.accountDeletion.deleteMany({ where: { userId: { in: [userId, otherId] } } });
        await removeUsers(prisma, [userId, otherId]);
        provider.checkouts.clear();
        provider.subscriptions.clear();
    });
    afterAll(async () => {
        await app.close();
    });

    it('should require authentication and reject browser-selected customers, prices and return URLs', async () => {
        expect((await request('/billing', 'GET', undefined, '')).status).toBe(401);
        for (const body of [
            { customerId: 'foreign' },
            { priceId: 'foreign' },
            { returnUrl: 'https://attacker.invalid' },
        ])
            expect((await request('/billing/checkout', 'POST', body)).status).toBe(400);
        expect((await request('/billing?checkout=success')).status).toBe(400);
        expect(await prisma.subscription.count({ where: { userId } })).toBe(0);
    });

    it('should let a user without Clubs buy and reuse one checkout under concurrent requests', async () => {
        const create = vi.spyOn(provider, 'createCheckoutSession');
        const responses = await Promise.all([checkout(), checkout(), checkout()]);
        expect(responses.map((response) => response.status)).toEqual([201, 201, 201]);
        expect(create).toHaveBeenCalledTimes(1);
        const urls = await Promise.all(responses.map((response) => response.json()));
        expect(urls[0]).toEqual(urls[1]);
        expect(await prisma.subscription.count({ where: { userId } })).toBe(1);
        expect(
            await prisma.billingAuditEvent.count({
                where: { subscription: { userId }, action: 'CHECKOUT_CREATED' },
            }),
        ).toBe(1);
        expect((await request('/billing')).headers.get('cache-control')).toBe('private, no-store');
    });

    it('should reuse durable customer and checkout identities after lost provider responses', async () => {
        const createCustomer = provider.createCustomer.bind(provider);
        const customerSpy = vi
            .spyOn(provider, 'createCustomer')
            .mockImplementationOnce(async (reference) => {
                await createCustomer(reference);
                throw new BillingProviderError();
            });
        expect((await checkout()).status).toBe(503);
        const create = provider.createCheckoutSession.bind(provider);
        const checkoutSpy = vi
            .spyOn(provider, 'createCheckoutSession')
            .mockImplementationOnce(async (input) => {
                await create(input);
                throw new BillingProviderError();
            });
        expect((await checkout()).status).toBe(503);
        const pending = await account();
        expect(pending.checkoutRequestId).not.toBeNull();
        expect((await checkout()).status).toBe(201);
        expect(customerSpy.mock.calls[0]).toEqual(customerSpy.mock.calls[1]);
        expect(checkoutSpy.mock.calls[0]).toEqual(checkoutSpy.mock.calls[1]);
        expect(provider.checkouts.size).toBe(1);
    });

    it('should confirm payment from stored provider truth and block a second active subscription', async () => {
        expect((await checkout()).status).toBe(201);
        expect((await readSummary()).plan).toBe('FREE');
        const id = await complete();
        const summary: IBillingSummary = await readSummary();
        expect(summary.plan).toBe('PRO');
        expect(summary.paidThrough).not.toBeNull();
        expect((await checkout()).status).toBe(409);
        provider.subscriptions.get(id)!.cancelAtPeriodEnd = true;
        expect((await readSummary()).cancelAtPeriodEnd).toBe(true);
    });

    it('should keep unpaid returns pending and leave expired paid periods on Free', async () => {
        expect((await checkout()).status).toBe(201);
        const id = await complete(false);
        expect((await readSummary()).plan).toBe('FREE');
        expect((await checkout()).status).toBe(409);
        Object.assign(provider.subscriptions.get(id)!, {
            status: 'PAYMENT_OVERDUE',
            paidThrough: new Date(Date.now() - 1000),
        });
        const summary: IBillingSummary = await readSummary();
        expect(summary.status).toBe('PAYMENT_OVERDUE');
        expect(summary.plan).toBe('FREE');
    });

    it('should create a new attempt only after the provider confirms expiry', async () => {
        expect((await checkout()).status).toBe(201);
        const previous = await account();
        provider.checkouts.get(previous.providerCheckoutId!)!.status = 'expired';
        expect((await checkout()).status).toBe(201);
        expect((await account()).checkoutRequestId).not.toBe(previous.checkoutRequestId);
        expect(provider.checkouts.size).toBe(2);
    });

    it('should scope portal and invoice calls to the caller, independent of Club roles', async () => {
        expect((await checkout()).status).toBe(201);
        expect((await request('/billing/checkout', 'POST', {}, otherCookie)).status).toBe(201);
        const portal = vi.spyOn(provider, 'createPortalSession');
        const invoices = vi.spyOn(provider, 'listInvoices');
        expect((await request('/billing/portal', 'POST', {})).status).toBe(201);
        expect((await request('/billing/invoices')).status).toBe(200);
        const owner = await account();
        expect(portal.mock.calls[0]?.[0]).toBe(owner.providerCustomerId);
        expect(invoices).toHaveBeenCalledWith(owner.providerCustomerId, undefined);
        expect(
            (await prisma.subscription.findUniqueOrThrow({ where: { userId: otherId } }))
                .providerCustomerId,
        ).not.toBe(owner.providerCustomerId);
        expect(
            (
                await request(
                    '/billing/portal',
                    'POST',
                    { customerId: owner.providerCustomerId },
                    otherCookie,
                )
            ).status,
        ).toBe(400);
    });

    it('should seal checkout after deletion and retain a retry until cancellation succeeds', async () => {
        expect((await checkout()).status).toBe(201);
        const id = await complete();
        await request('/billing');
        await prisma.user.update({ where: { id: userId }, data: { status: 'ANONYMIZED' } });
        await prisma.accountDeletion.create({ data: { userId, status: 'PENDING' } });
        vi.spyOn(provider, 'cancelSubscription').mockRejectedValueOnce(new BillingProviderError());
        const worker = app.get(AccountDeletionWorkerService);
        await worker.sweep();
        const failed = await prisma.accountDeletion.findUniqueOrThrow({ where: { userId } });
        expect(failed.status).toBe('PENDING');
        expect(failed.failure).toBe('BILLING_UNAVAILABLE');
        await worker.sweep(new Date(failed.nextAttemptAt.getTime() + 1000));
        expect(
            (await prisma.accountDeletion.findUniqueOrThrow({ where: { userId } })).billing,
        ).toBe('CANCELLED');
        expect(provider.subscriptions.get(id)?.status).toBe('ENDED');
        expect((await checkout()).status).toBe(401);
    });

    it('should expire unfinished checkout before completing deletion', async () => {
        expect((await checkout()).status).toBe(201);
        const sessionId = (await account()).providerCheckoutId!;
        await prisma.user.update({ where: { id: userId }, data: { status: 'ANONYMIZED' } });
        await prisma.accountDeletion.create({ data: { userId, status: 'PENDING' } });
        await app.get(AccountDeletionWorkerService).sweep();
        expect(provider.checkouts.get(sessionId)?.status).toBe('expired');
        expect((await prisma.accountDeletion.findUniqueOrThrow({ where: { userId } })).status).toBe(
            'COMPLETE',
        );
    });
    it('should reconcile a payment racing deletion before marking cancellation complete', async () => {
        expect((await checkout()).status).toBe(201);
        const sessionId = (await account()).providerCheckoutId!;
        await prisma.user.update({ where: { id: userId }, data: { status: 'ANONYMIZED' } });
        await prisma.accountDeletion.create({ data: { userId, status: 'PENDING' } });
        vi.spyOn(provider, 'expireCheckoutSession').mockImplementationOnce(async () => {
            await complete();
            throw new BillingProviderError();
        });
        const worker = app.get(AccountDeletionWorkerService);
        await worker.sweep();
        const job = await prisma.accountDeletion.findUniqueOrThrow({ where: { userId } });
        expect(job.status).toBe('PENDING');
        await worker.sweep(new Date(job.nextAttemptAt.getTime() + 1000));
        const id = provider.checkouts.get(sessionId)!.subscriptionId!;
        expect(provider.subscriptions.get(id)?.status).toBe('ENDED');
        expect(
            (await prisma.accountDeletion.findUniqueOrThrow({ where: { userId } })).billing,
        ).toBe('CANCELLED');
    });

    it('should refuse blind replay outside the provider idempotency window', async () => {
        const create = vi
            .spyOn(provider, 'createCheckoutSession')
            .mockRejectedValueOnce(new BillingProviderError());
        expect((await checkout()).status).toBe(503);
        await prisma.subscription.update({
            where: { userId },
            data: { checkoutStartedAt: new Date(Date.now() - 24 * 3600_000) },
        });
        expect((await checkout()).status).toBe(503);
        expect(create).toHaveBeenCalledTimes(1);
        expect((await account()).providerCheckoutId).toBeNull();
    });
    it('should export only own billing state and audit while excluding retry identities', async () => {
        expect((await checkout()).status).toBe(201);
        expect((await request('/billing/checkout', 'POST', {}, otherCookie)).status).toBe(201);
        const own = await account();
        const peer = await prisma.subscription.findUniqueOrThrow({ where: { userId: otherId } });
        const archive = gunzipSync(
            await buildArchive(prisma, app.get(StorageService), userId),
        ).toString('utf8');
        expect(archive).toContain(own.providerCustomerId!);
        expect(archive).toContain('CHECKOUT_CREATED');
        expect(archive).not.toContain(peer.providerCustomerId!);
        expect(archive).not.toContain(own.checkoutRequestId!);
        expect(archive).not.toContain(own.providerCheckoutId!);
    });
    it('should finish deletion without provider calls when checkout never reached a payable resource', async () => {
        await prisma.subscription.create({ data: { userId } });
        await prisma.user.update({ where: { id: userId }, data: { status: 'ANONYMIZED' } });
        await prisma.accountDeletion.create({ data: { userId, status: 'PENDING' } });
        const cancel = vi.spyOn(provider, 'cancelSubscription');
        const expire = vi.spyOn(provider, 'expireCheckoutSession');
        await app.get(AccountDeletionWorkerService).sweep();
        expect(cancel).not.toHaveBeenCalled();
        expect(expire).not.toHaveBeenCalled();
        expect(await prisma.accountDeletion.findUniqueOrThrow({ where: { userId } })).toMatchObject(
            { status: 'COMPLETE', billing: 'NOT_REQUIRED' },
        );
    });
});
