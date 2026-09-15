export interface ContactDeliveryRecord {
  readonly id: string;
  readonly message: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly attemptCount: number;
}

export abstract class ContactDeliveryStore {
  abstract claim(now: Date): Promise<ContactDeliveryRecord | undefined>;
  abstract complete(id: string, attemptCount: number, providerMessageId: string, now: Date): Promise<void>;
  abstract fail(id: string, attemptCount: number, errorCode: string, nextAttemptAt: Date | undefined): Promise<void>;
}

export abstract class ContactSender {
  abstract send(message: ContactDeliveryRecord): Promise<string>;
}
