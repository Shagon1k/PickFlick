export const EMAIL_CLIENT = Symbol('EMAIL_CLIENT');

export interface IEmailMessage {
    to: string;
    subject: string;
    text: string;
    replyTo?: string;
}

export interface IEmailClient {
    send(message: IEmailMessage): Promise<void>;
}
