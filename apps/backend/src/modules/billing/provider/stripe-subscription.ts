import type { TSubscriptionStatus } from '@pickflick/contracts';
import { z } from 'zod';

import { BillingProviderError, type ISubscriptionSnapshot } from '../billing.types.js';

const STATUSES = {
    incomplete: 'PENDING',
    trialing: 'PENDING',
    active: 'ACTIVE',
    past_due: 'PAYMENT_OVERDUE',
    unpaid: 'PAYMENT_OVERDUE',
    paused: 'PAUSED',
    canceled: 'ENDED',
    incomplete_expired: 'ENDED',
} as const satisfies Record<string, TSubscriptionStatus>;
const MILLISECONDS = 1000;
const instant = z
    .number()
    .int()
    .nonnegative()
    .transform((seconds) => new Date(seconds * MILLISECONDS))
    .pipe(z.date());
const reference = z.string().min(1).max(255);
const invoiceSchema = z.object({
    status: z.string().nullable(),
    lines: z.object({
        data: z.array(
            z.object({
                pricing: z
                    .object({ price_details: z.object({ price: reference }).nullish() })
                    .nullish(),
                parent: z
                    .object({
                        subscription_item_details: z
                            .object({ subscription_item: reference })
                            .nullish(),
                    })
                    .nullish(),
                period: z.object({ end: instant }),
            }),
        ),
    }),
});
const subscriptionSchema = z.object({
    id: reference,
    customer: reference,
    status: z.enum([
        'incomplete',
        'trialing',
        'active',
        'past_due',
        'unpaid',
        'paused',
        'canceled',
        'incomplete_expired',
    ]),
    cancel_at_period_end: z.boolean(),
    items: z.object({
        data: z
            .array(
                z.object({
                    id: reference,
                    quantity: z.literal(1),
                    price: z.object({ id: reference }),
                    current_period_start: instant,
                    current_period_end: instant,
                }),
            )
            .length(1),
    }),
    latest_invoice: z.union([invoiceSchema, reference, z.null()]),
});

export function toSubscriptionSnapshot(input: unknown, priceId: string): ISubscriptionSnapshot {
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success) throw new BillingProviderError('BILLING_INVALID_DATA');
    const subscription = parsed.data;
    const item = subscription.items.data[0]!;
    if (item.price.id !== priceId || item.current_period_end <= item.current_period_start)
        throw new BillingProviderError('BILLING_INVALID_DATA');
    const invoice = subscription.latest_invoice;
    const paidLine =
        typeof invoice === 'object' && invoice?.status === 'paid'
            ? invoice.lines.data.find(
                  (line) =>
                      line.pricing?.price_details?.price === priceId &&
                      line.parent?.subscription_item_details?.subscription_item === item.id,
              )
            : undefined;
    return {
        id: subscription.id,
        customerId: subscription.customer,
        priceId: item.price.id,
        status: STATUSES[subscription.status],
        periodStart: item.current_period_start,
        periodEnd: item.current_period_end,
        paidThrough: paidLine?.period.end ?? null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
}
