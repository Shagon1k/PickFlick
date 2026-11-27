import type { Prisma } from '@pickflick/database';

import { BillingProviderError, type IBillingProvider } from '../billing.types.js';
import { hasSubscriptionChanged, refreshBilling, type TSubscription } from '../billing-store.js';

const RECONCILE_INTERVAL_MS = 15 * 60_000;
export const BILLING_RETRY_MS = 60_000;

export async function reconcileAccount(
    tx: Prisma.TransactionClient,
    account: TSubscription,
    provider: IBillingProvider,
    now: Date,
) {
    // Lost Checkout responses need operator repair; never create a purchase in a background read.
    if (account.checkoutRequestId && !account.providerCheckoutId)
        throw new BillingProviderError('BILLING_INVALID_DATA');
    const updated = await refreshBilling(tx, account, provider);
    await tx.subscription.update({
        where: { id: account.id },
        data: {
            lastReconciledAt: now,
            nextReconcileAt: new Date(now.getTime() + RECONCILE_INTERVAL_MS),
            reconcileAttempts: 0,
            reconcileFailure: null,
        },
    });
    return hasSubscriptionChanged(account, updated);
}

export async function lockAccount(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'ANONYMIZED') return null;
    return tx.subscription.findUnique({ where: { userId } });
}
