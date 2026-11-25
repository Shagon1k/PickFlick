import 'server-only';

import type {
    IBillingHistory,
    IBillingOffer,
    IBillingRedirect,
    IBillingSummary,
} from '@pickflick/contracts';

import { requestApi } from '#lib/api.server';

const BILLING_TIMEOUT_MS = 40_000;

export const getBillingOffer = () => requestApi<IBillingOffer>('/billing/offer');
export const getBilling = () =>
    requestApi<IBillingSummary>('/billing', { timeoutMs: BILLING_TIMEOUT_MS });
export const getBillingHistory = (cursor?: string) => {
    const search = cursor ? `?${new URLSearchParams({ cursor }).toString()}` : '';
    return requestApi<IBillingHistory>(`/billing/invoices${search}`, {
        timeoutMs: BILLING_TIMEOUT_MS,
    });
};
export const createBillingCheckout = () =>
    requestApi<IBillingRedirect>('/billing/checkout', {
        method: 'POST',
        json: {},
        timeoutMs: BILLING_TIMEOUT_MS,
    });
export const createBillingPortal = () =>
    requestApi<IBillingRedirect>('/billing/portal', {
        method: 'POST',
        json: {},
        timeoutMs: BILLING_TIMEOUT_MS,
    });
