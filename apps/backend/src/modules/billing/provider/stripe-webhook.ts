import { z } from 'zod';

import { BillingWebhookError, type IBillingWebhookEvent } from '../billing.types.js';

export const STRIPE_API_VERSION = '2026-11-18.endive';
const MILLISECONDS = 1000;
const reference = z.string().min(1).max(255);
const envelopeSchema = z.object({
    id: reference,
    type: z.string().min(1).max(255),
    created: z
        .number()
        .int()
        .nonnegative()
        .transform((seconds) => new Date(seconds * MILLISECONDS))
        .pipe(z.date()),
    api_version: z.literal(STRIPE_API_VERSION),
    livemode: z.boolean(),
    data: z.object({ object: z.unknown() }),
});
const customerSchema = z.object({ customer: reference.nullable() });
const disputeSchema = z.object({ charge: reference });
const EVENT_KINDS = new Map<string, IBillingWebhookEvent['kind']>([
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
]);

/** Only identifiers survive the signed provider boundary; payload state never grants access. */
export function toWebhookEvent(input: unknown, isLiveMode: boolean): IBillingWebhookEvent {
    const parsed = envelopeSchema.safeParse(input);
    if (!parsed.success || parsed.data.livemode !== isLiveMode)
        throw new BillingWebhookError('INVALID_EVENT');
    const event = parsed.data;
    const kind = EVENT_KINDS.get(event.type) ?? 'IGNORED';
    let customerId: string | null = null;
    let paymentId: string | null = null;
    if (kind !== 'IGNORED') {
        if (event.type === 'charge.dispute.created') {
            const dispute = disputeSchema.safeParse(event.data.object);
            if (!dispute.success) throw new BillingWebhookError('INVALID_EVENT');
            paymentId = dispute.data.charge;
        } else {
            const customer = customerSchema.safeParse(event.data.object);
            if (!customer.success) throw new BillingWebhookError('INVALID_EVENT');
            customerId = customer.data.customer;
        }
    }
    return {
        providerEventId: event.id,
        kind,
        occurredAt: event.created,
        customerId,
        paymentId,
    };
}
