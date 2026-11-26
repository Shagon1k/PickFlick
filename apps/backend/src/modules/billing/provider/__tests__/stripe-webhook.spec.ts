import { createHmac, randomUUID } from 'node:crypto';

import { StripeBillingProvider } from '../stripe-billing.provider.js';
import { STRIPE_API_VERSION } from '../stripe-webhook.js';

// Synthetic fixtures derived from Stripe's snapshot-event schema, not recorded sandbox evidence.
const WEBHOOK_SECRET = `whsec_${randomUUID()}`;
const event = {
    id: 'evt_synthetic',
    type: 'customer.subscription.updated',
    api_version: STRIPE_API_VERSION,
    livemode: false,
    created: 1795608000,
    data: { object: { id: 'sub_synthetic', customer: 'cus_synthetic', status: 'active' } },
};
const provider = new StripeBillingProvider({
    secretKey: 'rk_test_synthetic',
    priceId: 'price_fixture',
    webhookSecret: WEBHOOK_SECRET,
});

function sign(payload: Buffer, timestamp = Math.floor(Date.now() / 1000), secret = WEBHOOK_SECRET) {
    const digest = createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(payload)
        .digest('hex');
    return `t=${timestamp},v1=${digest}`;
}

describe('Stripe webhook boundary', () => {
    it('should authenticate exact bytes before returning only neutral identifiers', () => {
        const payload = Buffer.from(JSON.stringify(event, null, 2));
        expect(provider.verifyWebhookEvent(payload, sign(payload))).toEqual({
            providerEventId: event.id,
            kind: 'SUBSCRIPTION_CHANGED',
            occurredAt: new Date(event.created * 1000),
            customerId: 'cus_synthetic',
            paymentId: null,
        });
        expect(() =>
            provider.verifyWebhookEvent(Buffer.from(JSON.stringify(event)), sign(payload)),
        ).toThrow('INVALID_SIGNATURE');
    });

    it('should reject absent, forged and stale signatures without exposing payloads', () => {
        const payload = Buffer.from(JSON.stringify(event));
        for (const signature of [
            '',
            'invalid',
            sign(payload, Math.floor(Date.now() / 1000) - 301),
            sign(payload, undefined, 'synthetic-wrong-secret'),
        ]) {
            expect(() => provider.verifyWebhookEvent(payload, signature)).toThrow(
                'INVALID_SIGNATURE',
            );
        }
    });

    it('should normalize every agreed event without interpreting payload subscription state', () => {
        const types = [
            ['checkout.session.completed', 'CHECKOUT_CHANGED'],
            ['checkout.session.async_payment_succeeded', 'CHECKOUT_CHANGED'],
            ['checkout.session.async_payment_failed', 'CHECKOUT_CHANGED'],
            ['customer.subscription.created', 'SUBSCRIPTION_CHANGED'],
            ['customer.subscription.updated', 'SUBSCRIPTION_CHANGED'],
            ['customer.subscription.deleted', 'SUBSCRIPTION_CHANGED'],
            ['invoice.paid', 'PAYMENT_CHANGED'],
            ['invoice.payment_failed', 'PAYMENT_CHANGED'],
            ['invoice.payment_action_required', 'PAYMENT_CHANGED'],
            ['charge.refunded', 'PAYMENT_REVIEW'],
            ['charge.dispute.created', 'PAYMENT_REVIEW'],
        ];
        for (const [type, kind] of types) {
            const payload = Buffer.from(
                JSON.stringify({
                    ...event,
                    type,
                    data: { object: { customer: 'cus_synthetic', charge: 'ch_synthetic' } },
                }),
            );
            expect(provider.verifyWebhookEvent(payload, sign(payload))).toMatchObject({
                kind,
                customerId: type === 'charge.dispute.created' ? null : 'cus_synthetic',
                paymentId: type === 'charge.dispute.created' ? 'ch_synthetic' : null,
            });
        }
    });

    it('should reject wrong versions, live events, malformed references and signed invalid JSON', () => {
        for (const input of [
            { ...event, api_version: '2025-03-31.basil' },
            { ...event, livemode: true },
            { ...event, data: { object: { customer: { id: 'expanded-unexpected' } } } },
        ]) {
            const payload = Buffer.from(JSON.stringify(input));
            expect(() => provider.verifyWebhookEvent(payload, sign(payload))).toThrow(
                'INVALID_EVENT',
            );
        }
        const malformed = Buffer.from('{');
        expect(() => provider.verifyWebhookEvent(malformed, sign(malformed))).toThrow(
            'INVALID_SIGNATURE',
        );
    });

    it('should explicitly ignore unsupported signed events and refuse unconfigured verification', () => {
        const payload = Buffer.from(JSON.stringify({ ...event, type: 'customer.updated' }));
        expect(provider.verifyWebhookEvent(payload, sign(payload))).toMatchObject({
            kind: 'IGNORED',
            customerId: null,
            paymentId: null,
        });
        const disabled = new StripeBillingProvider({
            secretKey: 'rk_test_synthetic',
            priceId: 'price_fixture',
        });
        expect(() => disabled.verifyWebhookEvent(payload, sign(payload))).toThrow(
            'BILLING_UNAVAILABLE',
        );
    });
});
