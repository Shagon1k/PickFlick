export const EMAIL_CLIENT = Symbol('EMAIL_CLIENT');

export interface IEmailMessage {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    idempotencyKey?: string;
    notificationId?: string;
}

export interface IEmailClient {
    send(message: IEmailMessage): Promise<string | void>;
}
