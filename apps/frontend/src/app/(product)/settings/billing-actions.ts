'use server';

import {
    billingHistoryQuerySchema,
    HTTP_STATUS,
    type IBillingHistory,
    type IBillingRedirect,
    type IBillingSummary,
} from '@pickflick/contracts';

import {
    createBillingCheckout,
    createBillingPortal,
    getBilling,
    getBillingHistory,
} from '#api/billing.server';
import { getFailureMessage } from '#lib/action-failure';

type TResult<TData> = { ok: true; data: TData } | { ok: false; message: string };

async function perform<TData>(operation: () => Promise<TData>): Promise<TResult<TData>> {
    try {
        return { ok: true, data: await operation() };
    } catch (error) {
        return {
            ok: false,
            message: getFailureMessage(error, {
                request: 'Billing',
                reasons: {
                    BILLING_DISABLED: 'Pro checkout is unavailable. You can continue on Free.',
                    SUBSCRIPTION_EXISTS:
                        'You already have a subscription. Refresh its status or open the billing portal.',
                    BILLING_INVALID_DATA:
                        'Billing needs reconciliation. Contact support before trying another purchase.',
                    CHECKOUT_RETRY:
                        'Checkout changed while this request was running. Refresh its status and try again.',
                    CHECKOUT_PENDING:
                        'Your payment is still being confirmed. Refresh its status before trying again.',
                },
                statuses: [
                    [
                        [HTTP_STATUS.UNAUTHORIZED],
                        'Your session has ended. Sign in again to manage your subscription.',
                    ],
                ],
                fallback:
                    'Billing is unavailable. Try again; do not start another purchase until its status is confirmed.',
            }),
        };
    }
}

export async function startCheckout(): Promise<TResult<IBillingRedirect>> {
    return perform(createBillingCheckout);
}
export async function openBillingPortal(): Promise<TResult<IBillingRedirect>> {
    return perform(createBillingPortal);
}
export async function refreshSubscription(): Promise<TResult<IBillingSummary>> {
    return perform(getBilling);
}
export async function readBillingHistory(cursor: unknown): Promise<TResult<IBillingHistory>> {
    const parsed = billingHistoryQuerySchema.safeParse({ cursor });
    if (!parsed.success)
        return { ok: false, message: 'This invoice page is invalid. Refresh billing history.' };
    return perform(() => getBillingHistory(parsed.data.cursor));
}
