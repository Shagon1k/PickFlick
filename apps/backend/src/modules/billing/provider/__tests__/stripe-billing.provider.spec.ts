import { BillingProviderError } from '../../billing.types.js';
import { StripeBillingProvider } from '../stripe-billing.provider.js';
import { STRIPE_API_VERSION } from '../stripe-webhook.js';

const price = {
    id: 'price_pro',
    active: true,
    currency: 'eur',
    unit_amount: 500,
    billing_scheme: 'per_unit',
    tax_behavior: 'exclusive',
    recurring: { interval: 'month', interval_count: 1 },
    product: { id: 'product_pro', active: true, tax_code: 'txcd_10103000' },
};
const checkout = {
    id: 'checkout_fixture',
    status: 'open',
    mode: 'subscription',
    customer: 'customer_own',
    subscription: null,
    url: 'https://checkout.stripe.com/fixture',
};
const subscription = {
    id: 'subscription_fixture',
    customer: 'customer_own',
    status: 'active',
    cancel_at_period_end: true,
    items: {
        data: [
            {
                id: 'item_pro',
                quantity: 1,
                price: { id: 'price_pro' },
                current_period_start: 1795608000,
                current_period_end: 1798200000,
            },
        ],
    },
    latest_invoice: {
        status: 'paid',
        lines: {
            data: [
                {
                    pricing: { price_details: { price: 'price_pro' } },
                    parent: { subscription_item_details: { subscription_item: 'item_pro' } },
                    period: { end: 1798200000 },
                },
            ],
        },
    },
};

describe('StripeBillingProvider', () => {
    let provider: StripeBillingProvider;
    const fetch = vi.fn<typeof globalThis.fetch>();
    function respond(value: unknown, status = 200) {
        fetch.mockResolvedValueOnce(
            new Response(JSON.stringify(value), {
                status,
                headers: { 'content-type': 'application/json' },
            }),
        );
    }
    beforeEach(() => {
        fetch.mockReset();
        vi.stubGlobal('fetch', fetch);
        provider = new StripeBillingProvider({
            secretKey: 'synthetic-placeholder',
            priceId: 'price_pro',
        });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should resolve disputed payment ownership inside the adapter without exposing charge data', async () => {
        respond({ id: 'ch_fixture', customer: 'customer_own' });
        await expect(provider.fetchPaymentCustomer('ch_fixture')).resolves.toBe('customer_own');
        expect(fetch.mock.calls[0]?.[0]).toEqual(expect.stringContaining('/charges/ch_fixture'));
        respond({ id: 'ch_fixture', customer: null });
        await expect(provider.fetchPaymentCustomer('ch_fixture')).resolves.toBeNull();
    });

    it('should create the exact Managed Payments offer without tax, method, trial or anchor overrides', async () => {
        respond(price);
        respond(checkout);
        await expect(
            provider.createCheckoutSession({
                customerId: 'customer_own',
                requestId: 'request_own',
                successUrl: 'https://app.example/settings',
                cancelUrl: 'https://app.example/cancel',
            }),
        ).resolves.toMatchObject({ customerId: 'customer_own', status: 'open' });
        const init = fetch.mock.calls[1]![1]!;
        const body = new URLSearchParams(typeof init.body === 'string' ? init.body : '');
        expect(Object.fromEntries(body)).toEqual({
            customer: 'customer_own',
            mode: 'subscription',
            'managed_payments[enabled]': 'true',
            'line_items[0][price]': 'price_pro',
            'line_items[0][quantity]': '1',
            success_url: 'https://app.example/settings',
            cancel_url: 'https://app.example/cancel',
        });
        const headers = new Headers(init.headers);
        expect(headers.get('Stripe-Version')).toBe(STRIPE_API_VERSION);
        expect(headers.get('Idempotency-Key')).toBe('checkout:request_own');
    });

    it('should reject a changed price, tax setting or product before creating Checkout', async () => {
        for (const changed of [
            { ...price, currency: 'usd' },
            { ...price, unit_amount: 600 },
            { ...price, tax_behavior: 'inclusive' },
            { ...price, product: { ...price.product, tax_code: 'foreign' } },
        ]) {
            respond(changed);
            await expect(
                provider.createCheckoutSession({
                    customerId: 'customer_own',
                    requestId: 'request_own',
                    successUrl: 'https://app.example/settings',
                    cancelUrl: 'https://app.example/cancel',
                }),
            ).rejects.toMatchObject({ reason: 'BILLING_INVALID_DATA' });
        }
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('should confirm the paid matching price and preserve a scheduled cancellation', async () => {
        respond(subscription);
        await expect(provider.fetchSubscription('subscription_fixture')).resolves.toMatchObject({
            status: 'ACTIVE',
            paidThrough: new Date(1798200000000),
            cancelAtPeriodEnd: true,
        });
        respond({
            ...subscription,
            latest_invoice: { ...subscription.latest_invoice, status: 'open' },
        });
        await expect(provider.fetchSubscription('subscription_fixture')).resolves.toMatchObject({
            paidThrough: null,
        });
    });

    it('should map overdue, pending, paused and ended states without accepting an unknown status', async () => {
        for (const [status, expected] of [
            ['past_due', 'PAYMENT_OVERDUE'],
            ['unpaid', 'PAYMENT_OVERDUE'],
            ['trialing', 'PENDING'],
            ['incomplete', 'PENDING'],
            ['paused', 'PAUSED'],
            ['canceled', 'ENDED'],
            ['incomplete_expired', 'ENDED'],
        ]) {
            respond({ ...subscription, status });
            await expect(provider.fetchSubscription('subscription_fixture')).resolves.toMatchObject(
                { status: expected },
            );
        }
        respond({ ...subscription, status: '__proto__' });
        await expect(provider.fetchSubscription('subscription_fixture')).rejects.toMatchObject({
            reason: 'BILLING_INVALID_DATA',
        });
    });

    it('should reject a foreign invoice cursor before listing customer invoices', async () => {
        respond({ customer: 'customer_other' });
        await expect(
            provider.listInvoices('customer_own', 'invoice_foreign'),
        ).rejects.toMatchObject({ reason: 'BILLING_RESOURCE_MISSING' });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should expose provider invoices including tax and a scoped next cursor', async () => {
        respond({
            data: [
                {
                    id: 'invoice_own',
                    total: 605,
                    currency: 'eur',
                    status: 'paid',
                    created: 1795608000,
                    hosted_invoice_url: 'https://invoice.stripe.com/fixture',
                },
            ],
            has_more: true,
        });
        await expect(provider.listInvoices('customer_own')).resolves.toEqual({
            invoices: [
                {
                    id: 'invoice_own',
                    amount: 605,
                    currency: 'eur',
                    status: 'paid',
                    createdAt: new Date(1795608000000).toISOString(),
                    documentUrl: 'https://invoice.stripe.com/fixture',
                },
            ],
            nextCursor: 'invoice_own',
        });
        expect(fetch.mock.calls[0]?.[0]).toEqual(expect.stringContaining('customer=customer_own'));
    });

    it('should reject unsafe redirect URLs and sanitize provider errors', async () => {
        respond({ ...checkout, url: 'javascript:alert(1)' });
        await expect(provider.fetchCheckoutSession('checkout_fixture')).rejects.toMatchObject({
            reason: 'BILLING_INVALID_DATA',
        });
        respond({ error: { type: 'api_error', message: 'sensitive-provider-payload' } }, 503);
        await expect(provider.fetchSubscription('subscription_fixture')).rejects.toEqual(
            new BillingProviderError(),
        );
    });

    it('should avoid another cancellation request when a replay finds the subscription ended', async () => {
        respond({ ...subscription, status: 'canceled' });
        await expect(
            provider.cancelSubscription('subscription_fixture', 'customer_own'),
        ).resolves.toMatchObject({
            status: 'ENDED',
        });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('should verify the customer before cancelling a provider subscription', async () => {
        respond({ ...subscription, customer: 'customer_other' });
        await expect(
            provider.cancelSubscription('subscription_fixture', 'customer_own'),
        ).rejects.toMatchObject({ reason: 'BILLING_INVALID_DATA' });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
