import type { IBillingHistory, TSubscriptionStatus } from '@pickflick/contracts';

export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');

export interface IBillingWebhookEvent {
    providerEventId: string;
    kind:
        | 'CHECKOUT_CHANGED'
        | 'SUBSCRIPTION_CHANGED'
        | 'PAYMENT_CHANGED'
        | 'PAYMENT_REVIEW'
        | 'IGNORED';
    occurredAt: Date;
    customerId: string | null;
    paymentId: string | null;
}

export class BillingWebhookError extends Error {
    constructor(readonly reason: 'INVALID_SIGNATURE' | 'INVALID_EVENT') {
        super(reason);
    }
}

export interface ISubscriptionSnapshot {
    id: string;
    customerId: string;
    priceId: string;
    status: TSubscriptionStatus;
    periodStart: Date;
    periodEnd: Date;
    paidThrough: Date | null;
    cancelAtPeriodEnd: boolean;
}

export interface ICheckoutSnapshot {
    id: string;
    customerId: string;
    status: 'open' | 'complete' | 'expired';
    url: string | null;
    subscriptionId: string | null;
}

export interface IBillingProvider {
    isEnabled: boolean;
    verifyWebhookEvent(payload: Buffer, signature: string): IBillingWebhookEvent;
    fetchPaymentCustomer(paymentId: string): Promise<string | null>;
    createCustomer(reference: string): Promise<string>;
    createCheckoutSession(input: {
        customerId: string;
        successUrl: string;
        cancelUrl: string;
        requestId: string;
    }): Promise<ICheckoutSnapshot>;
    fetchCheckoutSession(id: string): Promise<ICheckoutSnapshot>;
    expireCheckoutSession(id: string): Promise<void>;
    fetchSubscription(id: string): Promise<ISubscriptionSnapshot>;
    createPortalSession(customerId: string, returnUrl: string): Promise<string>;
    listInvoices(customerId: string, cursor?: string): Promise<IBillingHistory>;
    cancelSubscription(id: string, customerId: string): Promise<ISubscriptionSnapshot>;
}

export class BillingProviderError extends Error {
    constructor(
        readonly reason:
            | 'BILLING_UNAVAILABLE'
            | 'BILLING_RESOURCE_MISSING'
            | 'BILLING_INVALID_DATA' = 'BILLING_UNAVAILABLE',
    ) {
        super(reason);
    }
}
