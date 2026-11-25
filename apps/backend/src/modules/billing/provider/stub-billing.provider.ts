import { randomUUID } from 'node:crypto';

import type { IBillingHistory } from '@pickflick/contracts';

import {
    BillingProviderError,
    type IBillingProvider,
    type ICheckoutSnapshot,
    type ISubscriptionSnapshot,
} from '../billing.types.js';

/** Disabled in normal runtime; tests explicitly inject an enabled instance. */
export class StubBillingProvider implements IBillingProvider {
    readonly checkouts = new Map<string, ICheckoutSnapshot>();
    readonly subscriptions = new Map<string, ISubscriptionSnapshot>();
    private readonly customers = new Map<string, string>();
    private readonly requests = new Map<string, string>();
    constructor(readonly isEnabled = false) {}

    createCustomer(reference: string): Promise<string> {
        const customer = this.customers.get(reference) ?? `customer_${randomUUID()}`;
        this.customers.set(reference, customer);
        return Promise.resolve(customer);
    }

    createCheckoutSession(input: {
        customerId: string;
        successUrl: string;
        cancelUrl: string;
        requestId: string;
    }): Promise<ICheckoutSnapshot> {
        const existing = this.requests.get(input.requestId);
        if (existing) return this.fetchCheckoutSession(existing);
        const id = `checkout_${randomUUID()}`;
        const session: ICheckoutSnapshot = {
            id,
            customerId: input.customerId,
            status: 'open',
            subscriptionId: null,
            url: input.successUrl,
        };
        this.checkouts.set(id, session);
        this.requests.set(input.requestId, id);
        return Promise.resolve(session);
    }

    fetchCheckoutSession(id: string): Promise<ICheckoutSnapshot> {
        const checkout = this.checkouts.get(id);
        if (!checkout) throw new BillingProviderError('BILLING_RESOURCE_MISSING');
        return Promise.resolve({ ...checkout });
    }

    expireCheckoutSession(id: string): Promise<void> {
        const checkout = this.checkouts.get(id);
        if (!checkout) throw new BillingProviderError('BILLING_RESOURCE_MISSING');
        if (checkout.status === 'complete') throw new BillingProviderError();
        checkout.status = 'expired';
        checkout.url = null;
        return Promise.resolve();
    }

    fetchSubscription(id: string): Promise<ISubscriptionSnapshot> {
        const subscription = this.subscriptions.get(id);
        if (!subscription) throw new BillingProviderError('BILLING_RESOURCE_MISSING');
        return Promise.resolve({ ...subscription });
    }

    createPortalSession(_customerId: string, returnUrl: string): Promise<string> {
        return Promise.resolve(returnUrl);
    }
    listInvoices(): Promise<IBillingHistory> {
        return Promise.resolve({ invoices: [], nextCursor: null });
    }

    async cancelSubscription(id: string, customerId: string): Promise<ISubscriptionSnapshot> {
        const subscription = await this.fetchSubscription(id);
        if (subscription.customerId !== customerId)
            throw new BillingProviderError('BILLING_INVALID_DATA');
        subscription.status = 'ENDED';
        subscription.cancelAtPeriodEnd = false;
        this.subscriptions.set(id, subscription);
        return subscription;
    }
}
