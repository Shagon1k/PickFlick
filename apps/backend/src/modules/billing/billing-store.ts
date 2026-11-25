import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pickflick/database';

import {
    BillingProviderError,
    type IBillingProvider,
    type ISubscriptionSnapshot,
} from './billing.types.js';

export type TSubscription = Prisma.SubscriptionGetPayload<object>;
export const BILLING_TRANSACTION = { timeout: 35_000, maxWait: 10_000 };
// Stripe retains idempotency keys for at least 24h. An unresolved older request needs reconciliation.
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60_000;

export async function lockBillingUser(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId, status: 'ACTIVE' } });
    if (!user) throw new NotFoundException();
}

export function assertRetryWindow(startedAt: Date) {
    if (Date.now() - startedAt.getTime() >= IDEMPOTENCY_WINDOW_MS)
        throw new BillingProviderError('BILLING_INVALID_DATA');
}

export function auditBilling(tx: Prisma.TransactionClient, subscriptionId: string, action: string) {
    return tx.billingAuditEvent.create({ data: { subscriptionId, action } });
}

export async function saveSnapshot(
    tx: Prisma.TransactionClient,
    account: TSubscription,
    snapshot: ISubscriptionSnapshot,
) {
    if (snapshot.customerId !== account.providerCustomerId)
        throw new BillingProviderError('BILLING_INVALID_DATA');
    const paidThrough = snapshot.paidThrough ?? account.paidThrough;
    const plan =
        snapshot.status !== 'ENDED' &&
        snapshot.status !== 'PENDING' &&
        paidThrough &&
        paidThrough > new Date()
            ? 'PRO'
            : 'FREE';
    const updated = await tx.subscription.update({
        where: { id: account.id },
        data: {
            providerSubscriptionId: snapshot.id,
            providerPriceId: snapshot.priceId,
            status: snapshot.status,
            periodStart: snapshot.periodStart,
            periodEnd: snapshot.periodEnd,
            paidThrough,
            cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
            plan,
        },
    });
    if (
        account.status !== updated.status ||
        account.plan !== updated.plan ||
        account.cancelAtPeriodEnd !== updated.cancelAtPeriodEnd ||
        account.paidThrough?.getTime() !== updated.paidThrough?.getTime()
    )
        await auditBilling(tx, account.id, 'SUBSCRIPTION_REFRESHED');
    return updated;
}

export async function refreshBilling(
    tx: Prisma.TransactionClient,
    account: TSubscription,
    provider: IBillingProvider,
) {
    let current = account;
    if (current.providerCheckoutId) {
        const checkout = await provider.fetchCheckoutSession(current.providerCheckoutId);
        if (checkout.customerId !== current.providerCustomerId)
            throw new BillingProviderError('BILLING_INVALID_DATA');
        if (checkout.status === 'expired')
            current = await tx.subscription.update({
                where: { id: account.id },
                data: {
                    providerCheckoutId: null,
                    checkoutRequestId: null,
                    checkoutStartedAt: null,
                },
            });
        if (checkout.status === 'complete' && checkout.subscriptionId)
            current = await tx.subscription.update({
                where: { id: account.id },
                data: {
                    providerSubscriptionId: checkout.subscriptionId,
                    paidThrough: null,
                    plan: 'FREE',
                    providerCheckoutId: null,
                    checkoutRequestId: null,
                    checkoutStartedAt: null,
                },
            });
    }
    if (current.providerSubscriptionId)
        current = await saveSnapshot(
            tx,
            current,
            await provider.fetchSubscription(current.providerSubscriptionId),
        );
    return current;
}
