import { z } from 'zod';

export const emailWebhookEnvelopeSchema = z.object({ type: z.string() });
export const emailWebhookSchema = z.object({
    type: z.enum([
        'email.sent',
        'email.delivered',
        'email.delivery_delayed',
        'email.bounced',
        'email.complained',
        'email.failed',
        'email.suppressed',
    ]),
    created_at: z.iso.datetime({ offset: true }),
    data: z.object({
        email_id: z.uuid(),
        to: z.array(z.email()).length(1),
        tags: z.record(z.string(), z.string()).optional(),
    }),
});
