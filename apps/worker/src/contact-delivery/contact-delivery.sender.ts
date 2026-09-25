import type { WorkerEnvironment } from '@pickflick/config/environment';

import { ContactProviderError } from './contact-delivery.errors.js';
import { ContactSender, type ContactDeliveryRecord } from './contact-delivery.types.js';

function plainTextBody(message: ContactDeliveryRecord): string {
    return [
        `Name: ${message.name ?? 'Not provided'}`,
        `Email: ${message.email ?? 'Not provided'}`,
        '',
        'Message:',
        message.message,
    ].join('\n');
}

export class ResendContactSender extends ContactSender {
    constructor(
        private readonly environment: WorkerEnvironment,
        private readonly request: typeof fetch = fetch,
    ) {
        super();
    }

    async send(message: ContactDeliveryRecord): Promise<string> {
        let response: Response;
        try {
            response = await this.request('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${this.environment.resend.apiKey}`,
                    'content-type': 'application/json',
                    'idempotency-key': `contact-${message.id}`,
                },
                body: JSON.stringify({
                    from: this.environment.resend.from,
                    to: [this.environment.contact.deliveryTo],
                    subject: 'PickFlick contact message',
                    text: plainTextBody(message),
                    ...(this.environment.appEnvironment === 'production'
                        ? { reply_to: ['hello@pick-flick.app'] }
                        : {}),
                }),
                signal: AbortSignal.timeout(5_000),
            });
        } catch {
            throw new ContactProviderError('REQUEST_FAILED', true);
        }

        if (!response.ok) {
            const retryable =
                response.status === 408 || response.status === 429 || response.status >= 500;
            throw new ContactProviderError(`HTTP_${response.status}`, retryable);
        }

        let body: unknown;
        try {
            body = await response.json();
        } catch {
            throw new ContactProviderError('INVALID_RESPONSE', true);
        }
        const id = typeof body === 'object' && body !== null && 'id' in body ? body.id : undefined;
        if (typeof id !== 'string' || !id || id.length > 200) {
            throw new ContactProviderError('INVALID_RESPONSE', true);
        }
        return id;
    }
}
