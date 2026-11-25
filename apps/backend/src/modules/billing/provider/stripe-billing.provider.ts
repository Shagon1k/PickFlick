import type { IBillingHistory } from '@pickflick/contracts';
import Stripe from 'stripe';
import { z } from 'zod';

import {
    BillingProviderError,
    type IBillingProvider,
    type ICheckoutSnapshot,
} from '../billing.types.js';
import { toSubscriptionSnapshot } from './stripe-subscription.js';

export const STRIPE_API_VERSION = '2026-11-18.endive';
const PROVIDER_TIMEOUT_MS = 8000;
const MONTHLY_PRICE = 500;
const MILLISECONDS = 1000;
const HISTORY_LIMIT = 10;
const invoiceSchema = z.object({
    id: z.string().min(1),
    total: z.number().int(),
    currency: z.string().regex(/^[a-z]{3}$/u),
    status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).nullable(),
    created: z.number().int().nonnegative(),
    hosted_invoice_url: z.string().nullish(),
});
const checkoutSchema = z.object({
    id: z.string().min(1),
    customer: z.string().min(1),
    mode: z.literal('subscription'),
    status: z.enum(['open', 'complete', 'expired']),
    subscription: z.string().min(1).nullable(),
    url: z.string().nullable(),
});

export class StripeBillingProvider implements IBillingProvider {
    readonly isEnabled = true;
    private readonly client: Stripe;

    constructor(private readonly config: { secretKey: string; priceId: string }) {
        this.client = new Stripe(config.secretKey, {
            apiVersion: STRIPE_API_VERSION,
            timeout: PROVIDER_TIMEOUT_MS,
            maxNetworkRetries: 0,
            httpClient: Stripe.createFetchHttpClient(),
        });
    }

    createCustomer(reference: string) {
        return this.call(async () => {
            const customer = await this.client.customers.create(
                { metadata: { pickflick_reference: reference } },
                { idempotencyKey: `customer:${reference}` },
            );
            return z.string().min(1).parse(customer.id);
        });
    }

    createCheckoutSession(input: {
        customerId: string;
        successUrl: string;
        cancelUrl: string;
        requestId: string;
    }) {
        return this.call(async () => {
            await this.assertOffer();
            const session = await this.client.checkout.sessions.create(
                {
                    customer: input.customerId,
                    mode: 'subscription',
                    managed_payments: { enabled: true },
                    line_items: [{ price: this.config.priceId, quantity: 1 }],
                    success_url: input.successUrl,
                    cancel_url: input.cancelUrl,
                },
                { idempotencyKey: `checkout:${input.requestId}` },
            );
            return this.toCheckout(session);
        });
    }

    fetchCheckoutSession(id: string) {
        return this.call(async () =>
            this.toCheckout(await this.client.checkout.sessions.retrieve(id)),
        );
    }

    expireCheckoutSession(id: string) {
        return this.call(async () => {
            await this.client.checkout.sessions.expire(id);
        });
    }

    fetchSubscription(id: string) {
        return this.call(async () =>
            toSubscriptionSnapshot(
                await this.client.subscriptions.retrieve(id, {
                    expand: ['latest_invoice'],
                }),
                this.config.priceId,
            ),
        );
    }

    createPortalSession(customerId: string, returnUrl: string) {
        return this.call(async () => {
            const session = await this.client.billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl,
            });
            return this.validateUrl(session.url);
        });
    }

    listInvoices(customerId: string, cursor?: string): Promise<IBillingHistory> {
        return this.call(async () => {
            if (cursor) {
                const invoice = await this.client.invoices.retrieve(cursor);
                if (invoice.customer !== customerId)
                    throw new BillingProviderError('BILLING_RESOURCE_MISSING');
            }
            const page = await this.client.invoices.list({
                customer: customerId,
                limit: HISTORY_LIMIT,
                starting_after: cursor,
            });
            return {
                invoices: page.data.map((input) => {
                    const invoice = invoiceSchema.parse(input);
                    return {
                        id: invoice.id,
                        amount: invoice.total,
                        currency: invoice.currency,
                        status: invoice.status,
                        createdAt: new Date(invoice.created * MILLISECONDS).toISOString(),
                        documentUrl: invoice.hosted_invoice_url
                            ? this.validateUrl(invoice.hosted_invoice_url)
                            : null,
                    };
                }),
                nextCursor: page.has_more ? page.data.at(-1)!.id : null,
            };
        });
    }

    cancelSubscription(id: string, customerId: string) {
        return this.call(async () => {
            const current = await this.client.subscriptions.retrieve(id, {
                expand: ['latest_invoice'],
            });
            if (current.customer !== customerId)
                throw new BillingProviderError('BILLING_INVALID_DATA');
            if (current.status === 'canceled' || current.status === 'incomplete_expired')
                return toSubscriptionSnapshot(current, this.config.priceId);
            return toSubscriptionSnapshot(
                await this.client.subscriptions.cancel(id, { expand: ['latest_invoice'] }),
                this.config.priceId,
            );
        });
    }

    private async assertOffer() {
        const price = await this.client.prices.retrieve(this.config.priceId, {
            expand: ['product'],
        });
        const product = price.product;
        if (
            !price.active ||
            price.currency !== 'eur' ||
            price.unit_amount !== MONTHLY_PRICE ||
            price.tax_behavior !== 'exclusive' ||
            price.recurring?.interval !== 'month' ||
            price.recurring.interval_count !== 1 ||
            price.billing_scheme !== 'per_unit' ||
            typeof product === 'string' ||
            product.deleted ||
            !product.active ||
            product.tax_code !== 'txcd_10103000'
        ) {
            throw new BillingProviderError('BILLING_INVALID_DATA');
        }
    }

    private toCheckout(input: unknown): ICheckoutSnapshot {
        const session = checkoutSchema.parse(input);
        return {
            id: session.id,
            customerId: session.customer,
            status: session.status,
            subscriptionId: session.subscription,
            url: session.url ? this.validateUrl(session.url) : null,
        };
    }

    private validateUrl(value: string) {
        const url = URL.parse(value);
        if (
            !url ||
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            url.port ||
            !(
                url.hostname === 'link.com' ||
                url.hostname.endsWith('.link.com') ||
                url.hostname.endsWith('.stripe.com')
            )
        )
            throw new BillingProviderError('BILLING_INVALID_DATA');
        return value;
    }

    private async call<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof BillingProviderError) throw error;
            if (
                error instanceof Stripe.errors.StripeInvalidRequestError &&
                error.code === 'resource_missing'
            )
                throw new BillingProviderError('BILLING_RESOURCE_MISSING');
            throw new BillingProviderError(
                error instanceof z.ZodError ? 'BILLING_INVALID_DATA' : 'BILLING_UNAVAILABLE',
            );
        }
    }
}
