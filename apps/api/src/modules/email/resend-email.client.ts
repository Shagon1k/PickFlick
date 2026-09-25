import { Resend } from 'resend';

import type { IEmailClient, IEmailMessage } from './email.types.js';

export class ResendEmailClient implements IEmailClient {
    private readonly resend: Resend;

    constructor(
        apiKey: string,
        private readonly from: string,
    ) {
        this.resend = new Resend(apiKey);
    }

    async send(message: IEmailMessage): Promise<void> {
        const { error } = await this.resend.emails.send({
            from: this.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        });
        if (error) {
            throw new Error(`Resend rejected the email: ${error.name}`);
        }
    }
}
