import { HTTP_STATUS } from '@pickflick/contracts';
import { z } from 'zod';

import type { IEmailClient, IEmailMessage } from './email.types.js';

const REQUEST_TIMEOUT_MS = 15_000;
const responseSchema = z.object({ id: z.uuid() });
const errorSchema = z.object({ name: z.string() });

export class EmailDeliveryError extends Error {
    constructor(
        readonly reason: string,
        readonly canRetry: boolean,
    ) {
        super(`Email delivery failed: ${reason}`);
    }
}

export class ResendEmailClient implements IEmailClient {
    constructor(
        private readonly apiKey: string,
        private readonly from: string,
    ) {}

    async send(message: IEmailMessage): Promise<string> {
        // The SDK send method exposes no AbortSignal; bound the external request at this adapter.
        let response: Response;
        try {
            response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                redirect: 'error',
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    ...(message.idempotencyKey
                        ? { 'Idempotency-Key': message.idempotencyKey }
                        : {}),
                },
                body: JSON.stringify({
                    from: this.from,
                    to: message.to,
                    subject: message.subject,
                    text: message.text,
                    html: message.html,
                    reply_to: message.replyTo,
                    tags: message.notificationId
                        ? [{ name: 'notification_id', value: message.notificationId }]
                        : undefined,
                }),
            });
            const body: unknown = await response.json();
            if (response.ok) {
                const result = responseSchema.safeParse(body);
                if (result.success) return result.data.id;
                throw new EmailDeliveryError('invalid_response', true);
            }
            const error = errorSchema.safeParse(body);
            const canRetry =
                response.status === HTTP_STATUS.TOO_MANY_REQUESTS ||
                response.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR ||
                error.data?.name === 'concurrent_idempotent_requests';
            // Keep arbitrary provider messages/names and recipient data out of application logs.
            throw new EmailDeliveryError(`provider_${response.status}`, canRetry);
        } catch (error) {
            if (error instanceof EmailDeliveryError) throw error;
            throw new EmailDeliveryError('network_or_timeout', true);
        }
    }
}
