import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BILLING_PROVIDER, BillingProviderError, type IBillingProvider } from './billing.types.js';
import {
    assertRetryWindow,
    auditBilling,
    BILLING_TRANSACTION,
    lockBillingUser,
    refreshBilling,
} from './billing-store.js';

@Injectable()
export class BillingCheckoutService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(BILLING_PROVIDER) private readonly provider: IBillingProvider,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async create(userId: string) {
        if (!this.provider.isEnabled)
            throw new ServiceUnavailableException({ reason: 'BILLING_DISABLED' });
        // Commit identities before calling Stripe so a lost response can replay the same request.
        await this.prepare(userId);
        await this.prepareAttempt(userId);
        return this.prisma.$transaction(async (tx) => {
            await lockBillingUser(tx, userId);
            const account = await refreshBilling(
                tx,
                await tx.subscription.findUniqueOrThrow({ where: { userId } }),
                this.provider,
            );
            this.assertCanCheckout(account.status);
            if (account.providerCheckoutId) {
                const checkout = await this.provider.fetchCheckoutSession(
                    account.providerCheckoutId,
                );
                if (checkout.status === 'open' && checkout.url) return { url: checkout.url };
                throw new ConflictException({ reason: 'CHECKOUT_PENDING' });
            }
            if (
                !account.checkoutRequestId ||
                !account.checkoutStartedAt ||
                !account.providerCustomerId
            )
                throw new ConflictException({ reason: 'CHECKOUT_RETRY' });
            assertRetryWindow(account.checkoutStartedAt);
            const base = `${this.environment.auth.baseUrl}/settings?tab=subscription`;
            const checkout = await this.provider.createCheckoutSession({
                customerId: account.providerCustomerId,
                requestId: account.checkoutRequestId,
                successUrl: `${base}&checkout=returned`,
                cancelUrl: `${base}&checkout=cancelled`,
            });
            if (
                !checkout.url ||
                checkout.status !== 'open' ||
                checkout.customerId !== account.providerCustomerId
            )
                throw new BillingProviderError('BILLING_INVALID_DATA');
            await tx.subscription.update({
                where: { userId },
                data: { providerCheckoutId: checkout.id },
            });
            await auditBilling(tx, account.id, 'CHECKOUT_CREATED');
            return { url: checkout.url };
        }, BILLING_TRANSACTION);
    }

    private prepare(userId: string) {
        return this.prisma.$transaction(async (tx) => {
            await lockBillingUser(tx, userId);
            await tx.subscription.upsert({ where: { userId }, create: { userId }, update: {} });
        }, BILLING_TRANSACTION);
    }

    private prepareAttempt(userId: string) {
        return this.prisma.$transaction(async (tx) => {
            await lockBillingUser(tx, userId);
            let account = await tx.subscription.findUniqueOrThrow({ where: { userId } });
            if (!account.providerCustomerId) {
                assertRetryWindow(account.createdAt);
                const customerId = await this.provider.createCustomer(account.id);
                account = await tx.subscription.update({
                    where: { userId },
                    data: { providerCustomerId: customerId },
                });
            }
            account = await refreshBilling(tx, account, this.provider);
            this.assertCanCheckout(account.status);
            if (!account.checkoutRequestId)
                await tx.subscription.update({
                    where: { userId },
                    data: {
                        checkoutRequestId: randomUUID(),
                        checkoutStartedAt: new Date(),
                    },
                });
        }, BILLING_TRANSACTION);
    }

    private assertCanCheckout(status: string | null) {
        if (status && status !== 'ENDED')
            throw new ConflictException({ reason: 'SUBSCRIPTION_EXISTS' });
    }
}
