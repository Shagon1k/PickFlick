import { createHmac, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../../../app.module.js';
import { configureApplication } from '../../../../config/configure-application.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import {
    createUser,
    loadIntegrationEnvironment,
    withFailingInsert,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import { AccountDeletionWorkerService } from '../../../account/account-deletion-worker.service.js';
import { buildArchive } from '../../../data-exports/archive.js';
import { DataExportWorkerService } from '../../../data-exports/data-export-worker.service.js';
import { NotificationSignals } from '../../../notifications/notification-signals.js';
import { Transactions } from '../../../notifications/transactions.js';
import { StorageService } from '../../../storage/storage.service.js';
import { BILLING_PROVIDER, BillingProviderError } from '../../billing.types.js';
import { StripeBillingProvider } from '../../provider/stripe-billing.provider.js';
import { STRIPE_API_VERSION } from '../../provider/stripe-webhook.js';
import { StubBillingProvider } from '../../provider/stub-billing.provider.js';
import { BillingWorkerService } from '../billing-worker.service.js';

const WEBHOOK_SECRET = `whsec_${randomUUID()}`;
const verifier = new StripeBillingProvider({
    secretKey: 'rk_test_synthetic',
    priceId: 'price_fixture',
    webhookSecret: WEBHOOK_SECRET,
});

describe('BillingWorkerService', () => {
    const provider = new StubBillingProvider(true);
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let worker: BillingWorkerService;
    let baseUrl: string;
    let userId: string;
    let customerId: string;
    let subscriptionId: string;
    const eventIds: string[] = [];
    const signals = { publish: vi.fn().mockResolvedValue(undefined) };
    const account = () => prisma.subscription.findUniqueOrThrow({ where: { userId } });
    const notificationCount = () =>
        prisma.notification.count({ where: { recipientId: userId, event: 'BILLING_SERVICE' } });

    function buildEvent(type = 'customer.subscription.updated', customer = customerId) {
        const id = `evt_${randomUUID()}`;
        eventIds.push(id);
        return {
            id,
            type,
            created: Math.floor(Date.now() / 1000),
            api_version: STRIPE_API_VERSION,
            livemode: false,
            data: { object: { id: subscriptionId, customer, status: 'canceled' } },
        };
    }

    async function receive(input: unknown = buildEvent(), signature?: string) {
        const payload = JSON.stringify(input, null, 2);
        const timestamp = Math.floor(Date.now() / 1000);
        const digest = createHmac('sha256', WEBHOOK_SECRET)
            .update(`${timestamp}.${payload}`)
            .digest('hex');
        return fetch(`${baseUrl}/webhooks/stripe`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'stripe-signature': signature ?? `t=${timestamp},v1=${digest}`,
            },
            body: payload,
        });
    }

    beforeAll(async () => {
        const environment = loadIntegrationEnvironment();
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule.register(environment)],
        })
            .overrideProvider(BILLING_PROVIDER)
            .useValue(provider)
            .overrideProvider(NotificationSignals)
            .useValue(signals)
            .compile();
        app = moduleRef.createNestApplication<NestExpressApplication>({
            bodyParser: false,
            rawBody: true,
            logger: false,
        });
        configureApplication(app);
        await app.listen(0, '127.0.0.1');
        // Nest's HTTP adapter erases the bound socket address type.
        baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
        prisma = app.get(PrismaService);
        worker = app.get(BillingWorkerService);
        await worker.onModuleDestroy();
        await app.get(AccountDeletionWorkerService).onModuleDestroy();
        await app.get(DataExportWorkerService).onModuleDestroy();
    });

    beforeEach(async () => {
        userId = await createUser(prisma);
        customerId = `customer_${userId}`;
        subscriptionId = `subscription_${userId}`;
        vi.spyOn(provider, 'verifyWebhookEvent').mockImplementation((payload, signature) =>
            verifier.verifyWebhookEvent(payload, signature),
        );
        await prisma.subscription.create({
            data: {
                userId,
                providerCustomerId: customerId,
                providerSubscriptionId: subscriptionId,
                nextReconcileAt: new Date(Date.now() + 3600_000),
            },
        });
        provider.subscriptions.set(subscriptionId, {
            id: subscriptionId,
            customerId,
            priceId: 'price_fixture',
            status: 'ACTIVE',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 86400_000),
            paidThrough: new Date(Date.now() + 30 * 86400_000),
            cancelAtPeriodEnd: false,
        });
        signals.publish.mockClear();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await prisma.billingEvent.deleteMany({
            where: { providerEventId: { in: eventIds.splice(0) } },
        });
        await prisma.notificationEmailDelivery.deleteMany({
            where: { notification: { recipientId: userId } },
        });
        await prisma.notification.deleteMany({ where: { recipientId: userId } });
        await removeUsers(prisma, [userId]);
        provider.checkouts.clear();
        provider.subscriptions.clear();
    });
    afterAll(async () => {
        await app.close();
    });

    it('should reject invalid signatures before persistence and acknowledge duplicates before provider reads', async () => {
        const event = buildEvent();
        expect((await receive(event, 'invalid')).status).toBe(401);
        expect(await prisma.billingEvent.count({ where: { providerEventId: event.id } })).toBe(0);
        const fetchSubscription = vi.spyOn(provider, 'fetchSubscription');
        const responses = await Promise.all([receive(event), receive(event), receive(event)]);
        expect(responses.map((response) => response.status)).toEqual([204, 204, 204]);
        expect(fetchSubscription).not.toHaveBeenCalled();
        expect(await prisma.billingEvent.count({ where: { providerEventId: event.id } })).toBe(1);
        expect((await account()).plan).toBe('FREE');
        await Promise.all([
            worker.sweep(),
            new BillingWorkerService(prisma, provider, app.get(Transactions)).sweep(),
        ]);
        expect((await account()).plan).toBe('PRO');
        expect(await notificationCount()).toBe(1);
        expect(fetchSubscription).toHaveBeenCalledTimes(1);
        expect(signals.publish).toHaveBeenCalledWith(new Set([userId]));
        await receive(event);
        await worker.sweep();
        expect(await notificationCount()).toBe(1);
    });

    it('should converge unordered distinct events to current truth without repeating side effects', async () => {
        const older = { ...buildEvent('customer.subscription.deleted'), created: 1790000000 };
        expect((await receive(buildEvent('invoice.paid'))).status).toBe(204);
        await worker.sweep();
        expect((await receive(older)).status).toBe(204);
        await worker.sweep();
        expect((await account()).status).toBe('ACTIVE');
        expect(await notificationCount()).toBe(1);
        expect(await prisma.billingAuditEvent.count({ where: { subscription: { userId } } })).toBe(
            1,
        );
    });

    it('should serialize distinct concurrent events for one account into one transition', async () => {
        const events = [
            buildEvent(),
            buildEvent('invoice.paid'),
            buildEvent('customer.subscription.created'),
        ];
        await Promise.all(events.map((event) => receive(event)));
        const workers = [
            worker,
            new BillingWorkerService(prisma, provider, app.get(Transactions)),
            new BillingWorkerService(prisma, provider, app.get(Transactions)),
        ];
        await Promise.all(workers.map((processor) => processor.sweep()));
        expect((await account()).plan).toBe('PRO');
        expect(await notificationCount()).toBe(1);
        expect(await prisma.billingEvent.count({ where: { customerId, state: 'PROCESSED' } })).toBe(
            3,
        );
    });

    it('should project external cancellation and its reversal without a Settings read', async () => {
        provider.subscriptions.get(subscriptionId)!.cancelAtPeriodEnd = true;
        await receive();
        await worker.sweep();
        expect((await account()).cancelAtPeriodEnd).toBe(true);
        provider.subscriptions.get(subscriptionId)!.cancelAtPeriodEnd = false;
        await receive();
        await worker.sweep();
        expect((await account()).cancelAtPeriodEnd).toBe(false);
        expect(await notificationCount()).toBe(2);
    });

    it('should reconcile completed Checkout from its stored identity without a Settings read', async () => {
        const checkoutId = `checkout_${userId}`;
        provider.checkouts.set(checkoutId, {
            id: checkoutId,
            customerId,
            status: 'complete',
            subscriptionId,
            url: null,
        });
        await prisma.subscription.update({
            where: { userId },
            data: {
                providerSubscriptionId: null,
                providerCheckoutId: checkoutId,
                checkoutRequestId: randomUUID(),
                checkoutStartedAt: new Date(),
            },
        });
        await receive(buildEvent('checkout.session.async_payment_succeeded'));
        await worker.sweep();
        expect(await account()).toMatchObject({
            providerSubscriptionId: subscriptionId,
            plan: 'PRO',
            providerCheckoutId: null,
            checkoutRequestId: null,
        });
        expect(await notificationCount()).toBe(1);
    });

    it('should retain the confirmed paid period through failure without extending access', async () => {
        await receive(buildEvent('invoice.paid'));
        await worker.sweep();
        const paidThrough = (await account()).paidThrough;
        Object.assign(provider.subscriptions.get(subscriptionId)!, {
            status: 'PAYMENT_OVERDUE',
            paidThrough: null,
        });
        await receive(buildEvent('invoice.payment_action_required'));
        await worker.sweep();
        expect(await account()).toMatchObject({
            status: 'PAYMENT_OVERDUE',
            plan: 'PRO',
            paidThrough,
        });
        await prisma.subscription.update({
            where: { userId },
            data: { paidThrough: new Date(0), nextReconcileAt: new Date(0) },
        });
        await worker.sweep();
        expect((await account()).plan).toBe('FREE');
    });

    it('should refuse acknowledgement when the durable ledger insert fails', async () => {
        const event = buildEvent();
        await withFailingInsert(
            prisma,
            'BillingEvent',
            `NEW."customerId" = '${customerId}'`,
            async () => {
                expect((await receive(event)).status).toBe(500);
            },
        );
        expect(await prisma.billingEvent.count({ where: { providerEventId: event.id } })).toBe(0);
        expect((await receive(event)).status).toBe(204);
        await worker.sweep();
        expect((await account()).plan).toBe('PRO');
    });

    it('should retain failures durably and repair a retry without losing the event', async () => {
        const event = buildEvent();
        await receive(event);
        vi.spyOn(provider, 'fetchSubscription').mockRejectedValueOnce(new BillingProviderError());
        await worker.sweep();
        const pending = await prisma.billingEvent.findUniqueOrThrow({
            where: {
                provider_providerEventId: {
                    provider: 'stripe',
                    providerEventId: event.id,
                },
            },
        });
        expect(pending).toMatchObject({
            state: 'PENDING',
            attemptCount: 1,
            failure: 'BILLING_UNAVAILABLE',
            processedAt: null,
        });
        expect((await account()).plan).toBe('FREE');
        expect(await notificationCount()).toBe(0);
        await worker.sweep(new Date(pending.nextAttemptAt.getTime() + 1));
        expect((await account()).plan).toBe('PRO');
        expect(await notificationCount()).toBe(1);
    });

    it('should roll back projection and audit if notification persistence fails', async () => {
        await receive();
        await withFailingInsert(
            prisma,
            'Notification',
            `NEW."recipientId" = '${userId}'::uuid`,
            async () => {
                await worker.sweep();
            },
        );
        expect((await account()).plan).toBe('FREE');
        expect(await prisma.billingAuditEvent.count({ where: { subscription: { userId } } })).toBe(
            0,
        );
        const pending = await prisma.billingEvent.findFirstOrThrow({ where: { customerId } });
        expect(pending).toMatchObject({ state: 'PENDING', failure: 'PROCESSING_FAILED' });
        await worker.sweep(new Date(pending.nextAttemptAt.getTime() + 1));
        expect((await account()).plan).toBe('PRO');
        expect(await notificationCount()).toBe(1);
    });

    it('should repair scheduled drift and retry failures independently of webhook delivery', async () => {
        await prisma.subscription.update({
            where: { userId },
            data: { nextReconcileAt: new Date(0) },
        });
        vi.spyOn(provider, 'fetchSubscription').mockRejectedValueOnce(new BillingProviderError());
        await worker.sweep();
        const failed = await account();
        expect(failed).toMatchObject({
            reconcileAttempts: 1,
            reconcileFailure: 'BILLING_UNAVAILABLE',
        });
        await worker.sweep(new Date(failed.nextReconcileAt.getTime() + 1));
        const repaired = await account();
        expect(repaired).toMatchObject({
            plan: 'PRO',
            reconcileFailure: null,
            reconcileAttempts: 0,
        });
        expect(repaired.lastReconciledAt).not.toBeNull();
        await worker.sweep(new Date(repaired.nextReconcileAt.getTime() + 1));
        expect(await notificationCount()).toBe(1);
    });

    it('should reconcile refunds and disputes without assuming immediate revocation', async () => {
        await receive(buildEvent('charge.refunded'));
        await worker.sweep();
        const dispute = buildEvent('charge.dispute.created');
        const fetchPayment = vi
            .spyOn(provider, 'fetchPaymentCustomer')
            .mockResolvedValue(customerId);
        await receive({
            ...dispute,
            data: { object: { ...dispute.data.object, charge: 'ch_synthetic' } },
        });
        await worker.sweep();
        expect(fetchPayment).toHaveBeenCalledWith('ch_synthetic');
        expect((await account()).plan).toBe('PRO');
        expect(await notificationCount()).toBe(1);
    });

    it('should never grant Pro for unpaid or expired subscriptions', async () => {
        Object.assign(provider.subscriptions.get(subscriptionId)!, {
            status: 'PENDING',
            paidThrough: null,
        });
        await receive(buildEvent('checkout.session.completed'));
        await worker.sweep();
        expect((await account()).plan).toBe('FREE');
        Object.assign(provider.subscriptions.get(subscriptionId)!, {
            status: 'PAYMENT_OVERDUE',
            paidThrough: new Date(0),
        });
        await receive(buildEvent('invoice.payment_failed'));
        await worker.sweep();
        expect((await account()).plan).toBe('FREE');
    });

    it('should ignore other databases and unsupported events without restoring a deleted account', async () => {
        const unknown = buildEvent('customer.updated');
        expect((await receive(unknown)).status).toBe(204);
        expect(
            await prisma.billingEvent.findFirst({ where: { providerEventId: unknown.id } }),
        ).toMatchObject({ state: 'IGNORED' });
        await receive(buildEvent('customer.subscription.updated', 'customer_other_database'));
        await worker.sweep();
        expect((await account()).plan).toBe('FREE');
        await prisma.user.update({ where: { id: userId }, data: { status: 'ANONYMIZED' } });
        await receive();
        await worker.sweep();
        expect((await account()).plan).toBe('FREE');
        expect(await notificationCount()).toBe(0);
    });

    it('should export only the own minimal ledger without provider payloads or peer identifiers', async () => {
        const own = buildEvent();
        const peer = buildEvent('customer.subscription.updated', 'customer_peer');
        await receive(own);
        await receive(peer);
        const archive = gunzipSync(
            await buildArchive(prisma, app.get(StorageService), userId),
        ).toString('utf8');
        expect(archive).toContain(own.id);
        expect(archive).not.toContain(peer.id);
        expect(archive).not.toContain(WEBHOOK_SECRET);
        expect(archive).not.toContain('"livemode"');
    });
});
