import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import type { IBillingSummary } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BILLING_PROVIDER, BillingProviderError, type IBillingProvider } from './billing.types.js';
import { buildCheckoutRequest } from './billing-checkout.js';
import {
    assertRetryWindow,
    auditBilling,
    BILLING_TRANSACTION,
    lockBillingUser,
    refreshBilling,
    saveSnapshot,
    type TSubscription,
} from './billing-store.js';

function hasPayableResource(account: TSubscription) {
    return Boolean(
        account.providerSubscriptionId || account.checkoutRequestId || account.providerCheckoutId,
    );
}

@Injectable()
export class BillingService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(BILLING_PROVIDER) private readonly provider: IBillingProvider,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    getOffer() {
        return { isEnabled: this.provider.isEnabled };
    }

    async get(userId: string): Promise<IBillingSummary> {
        const account = await this.prisma.$transaction(async (tx) => {
            await lockBillingUser(tx, userId);
            const current = await tx.subscription.findUnique({ where: { userId } });
            if (!current) return null;
            this.assertEnabled();
            return refreshBilling(tx, current, this.provider);
        }, BILLING_TRANSACTION);
        const memberships = await this.prisma.membership.findMany({
            where: {
                userId,
                role: 'ADMIN',
                status: 'ACTIVE',
                club: { lifecycle: 'ACTIVE' },
            },
            select: {
                club: {
                    select: {
                        id: true,
                        name: true,
                        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
                    },
                },
            },
            orderBy: { clubId: 'asc' },
        });
        return {
            ...this.getOffer(),
            plan: account?.plan ?? 'FREE',
            status: account?.status ?? null,
            periodStart: account?.periodStart?.toISOString() ?? null,
            periodEnd: account?.periodEnd?.toISOString() ?? null,
            paidThrough: account?.paidThrough?.toISOString() ?? null,
            cancelAtPeriodEnd: account?.cancelAtPeriodEnd ?? false,
            hasCustomer: Boolean(account?.providerCustomerId),
            hasCheckout: Boolean(account?.checkoutRequestId),
            usage: {
                administeredClubs: memberships.length,
                clubs: memberships.map(({ club }) => ({
                    id: club.id,
                    name: club.name,
                    members: club._count.memberships,
                })),
            },
        };
    }

    createPortal(userId: string) {
        this.assertEnabled();
        return this.prisma.$transaction(async (tx) => {
            await lockBillingUser(tx, userId);
            const account = await tx.subscription.findUnique({ where: { userId } });
            if (!account?.providerCustomerId)
                throw new ServiceUnavailableException({ reason: 'BILLING_NO_CUSTOMER' });
            const url = await this.provider.createPortalSession(
                account.providerCustomerId,
                `${this.environment.auth.baseUrl}/settings?tab=subscription`,
            );
            await auditBilling(tx, account.id, 'PORTAL_OPENED');
            return { url };
        }, BILLING_TRANSACTION);
    }

    listInvoices(userId: string, cursor?: string) {
        this.assertEnabled();
        return this.prisma.$transaction(async (tx) => {
            await lockBillingUser(tx, userId);
            const account = await tx.subscription.findUnique({ where: { userId } });
            if (!account?.providerCustomerId) return { invoices: [], nextCursor: null };
            return this.provider.listInvoices(account.providerCustomerId, cursor);
        }, BILLING_TRANSACTION);
    }

    async cancelForDeletion(tx: Prisma.TransactionClient, userId: string) {
        let account = await tx.subscription.findUnique({ where: { userId } });
        if (!account || !hasPayableResource(account)) return 'NOT_REQUIRED';
        this.assertEnabled();
        // Reissue a lost Checkout response using its durable identity before closing it.
        if (account.checkoutRequestId && !account.providerCheckoutId) {
            assertRetryWindow(account.checkoutStartedAt!);
            const checkout = await this.provider.createCheckoutSession(
                buildCheckoutRequest(
                    account.providerCustomerId!,
                    account.checkoutRequestId,
                    this.environment.auth.baseUrl,
                ),
            );
            account = { ...account, providerCheckoutId: checkout.id };
        }
        if (account.providerCheckoutId) {
            const checkout = await this.provider.fetchCheckoutSession(account.providerCheckoutId);
            if (checkout.customerId !== account.providerCustomerId)
                throw new BillingProviderError('BILLING_INVALID_DATA');
            if (checkout.status === 'open') await this.provider.expireCheckoutSession(checkout.id);
            if (checkout.subscriptionId)
                account = { ...account, providerSubscriptionId: checkout.subscriptionId };
        }
        if (account.providerSubscriptionId)
            account = await saveSnapshot(
                tx,
                account,
                await this.provider.cancelSubscription(
                    account.providerSubscriptionId,
                    account.providerCustomerId!,
                ),
            );
        await tx.subscription.update({
            where: { userId },
            data: {
                plan: 'FREE',
                status: account.status ? 'ENDED' : null,
                providerCheckoutId: null,
                checkoutRequestId: null,
                checkoutStartedAt: null,
            },
        });
        await auditBilling(tx, account.id, 'CANCELLED_FOR_DELETION');
        return 'CANCELLED';
    }

    private assertEnabled() {
        if (!this.provider.isEnabled) throw new BillingProviderError();
    }
}
