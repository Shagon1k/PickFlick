import {
    Inject,
    Injectable,
    Logger,
    type OnModuleDestroy,
    type OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../../database/prisma.service.js';
import { Transactions } from '../../notifications/transactions.js';
import { BILLING_PROVIDER, BillingProviderError, type IBillingProvider } from '../billing.types.js';
import { BILLING_TRANSACTION } from '../billing-store.js';
import { BILLING_RETRY_MS, lockAccount, reconcileAccount } from './billing-reconciliation.js';

const SWEEP_INTERVAL_MS = 5000;
type TBillingEvent = Prisma.BillingEventGetPayload<object>;

@Injectable()
export class BillingWorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BillingWorkerService.name);
    private timer?: ReturnType<typeof setInterval>;
    private cycle?: Promise<void>;

    constructor(
        private readonly prisma: PrismaService,
        @Inject(BILLING_PROVIDER) private readonly provider: IBillingProvider,
        private readonly transactions: Transactions,
    ) {}

    onModuleInit() {
        if (!this.provider.isEnabled) return;
        this.timer = setInterval(() => {
            void this.sweep();
        }, SWEEP_INTERVAL_MS);
        this.timer.unref();
    }

    async onModuleDestroy() {
        clearInterval(this.timer);
        await this.cycle;
    }

    async sweep(now = new Date()): Promise<void> {
        if (!this.provider.isEnabled) return;
        if (this.cycle) return this.cycle;
        this.cycle = this.runOnce(now).catch(() => {
            this.logger.error({ event: 'billing.cycle.failed' });
        });
        try {
            await this.cycle;
        } finally {
            this.cycle = undefined;
        }
    }

    private async runOnce(now: Date) {
        await this.processEvent(now);
        await this.reconcileDue(now);
        const oldest = await this.prisma.billingEvent.findFirst({
            where: { state: 'PENDING' },
            orderBy: { receivedAt: 'asc' },
        });
        this.logger.log({
            event: 'billing.backlog',
            pending: await this.prisma.billingEvent.count({ where: { state: 'PENDING' } }),
            lagMs: oldest ? Math.max(0, now.getTime() - oldest.receivedAt.getTime()) : 0,
            reconciliationFailures: await this.prisma.subscription.count({
                where: { reconcileFailure: { not: null } },
            }),
        });
    }

    private processEvent(now: Date) {
        return this.transactions.write(async (tx) => {
            const [event] = await tx.$queryRaw<TBillingEvent[]>`SELECT * FROM "BillingEvent"
                WHERE state = 'PENDING' AND "nextAttemptAt" <= ${now}
                ORDER BY "nextAttemptAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
            if (!event) return;
            // Roll back projection, audit and notification together before persisting a failed attempt.
            await tx.$executeRaw`SAVEPOINT billing_projection`;
            try {
                const state = await this.applyEvent(tx, event, now);
                await tx.billingEvent.update({
                    where: { id: event.id },
                    data: {
                        state,
                        processedAt: now,
                        failure: null,
                        attemptCount: { increment: 1 },
                    },
                });
                this.logger.log({
                    event: 'billing.event.processed',
                    eventId: event.id,
                    state,
                    lagMs: Math.max(0, now.getTime() - event.receivedAt.getTime()),
                });
            } catch (error) {
                await tx.$executeRaw`ROLLBACK TO SAVEPOINT billing_projection`;
                await tx.billingEvent.update({
                    where: { id: event.id },
                    data: {
                        failure: this.getFailure(error),
                        attemptCount: { increment: 1 },
                        nextAttemptAt: new Date(now.getTime() + BILLING_RETRY_MS),
                    },
                });
                this.logger.error({
                    event: 'billing.event.retry',
                    eventId: event.id,
                    failure: this.getFailure(error),
                });
            }
        }, BILLING_TRANSACTION);
    }

    private async applyEvent(tx: Prisma.TransactionClient, event: TBillingEvent, now: Date) {
        const customerId =
            event.customerId ??
            (event.paymentId ? await this.provider.fetchPaymentCustomer(event.paymentId) : null);
        if (!customerId) return 'IGNORED';
        if (!event.customerId)
            await tx.billingEvent.update({ where: { id: event.id }, data: { customerId } });
        const found = await tx.subscription.findUnique({
            where: {
                provider_providerCustomerId: {
                    provider: event.provider,
                    providerCustomerId: customerId,
                },
            },
        });
        // Local, preview and UAT share a sandbox; another database's customers are unrelated.
        if (!found) return 'IGNORED';
        const account = await lockAccount(tx, found.userId);
        if (!account) return 'IGNORED';
        const hasMismatch = await reconcileAccount(tx, account, this.provider, now);
        this.logger.log({ event: 'billing.reconciled', subscriptionId: account.id, hasMismatch });
        return 'PROCESSED';
    }

    private async reconcileDue(now: Date) {
        const due = await this.prisma.subscription.findFirst({
            where: {
                provider: 'stripe',
                providerCustomerId: { not: null },
                nextReconcileAt: { lte: now },
                user: { status: { not: 'ANONYMIZED' } },
            },
            orderBy: [{ nextReconcileAt: 'asc' }, { id: 'asc' }],
        });
        if (!due) return;
        await this.transactions.write(async (tx) => {
            const account = await lockAccount(tx, due.userId);
            if (!account || account.nextReconcileAt > now) return;
            await tx.$executeRaw`SAVEPOINT billing_projection`;
            try {
                const hasMismatch = await reconcileAccount(tx, account, this.provider, now);
                this.logger.log({
                    event: 'billing.reconciled',
                    subscriptionId: account.id,
                    hasMismatch,
                });
            } catch (error) {
                await tx.$executeRaw`ROLLBACK TO SAVEPOINT billing_projection`;
                await tx.subscription.update({
                    where: { id: account.id },
                    data: {
                        reconcileFailure: this.getFailure(error),
                        reconcileAttempts: { increment: 1 },
                        nextReconcileAt: new Date(now.getTime() + BILLING_RETRY_MS),
                    },
                });
                this.logger.error({
                    event: 'billing.reconciliation.retry',
                    subscriptionId: account.id,
                    failure: this.getFailure(error),
                });
            }
        }, BILLING_TRANSACTION);
    }

    private getFailure(error: unknown) {
        return error instanceof BillingProviderError ? error.reason : 'PROCESSING_FAILED';
    }
}
