import type { WorkerEnvironment } from "@pickflick/config/environment";
import { createDatabaseClient } from "@pickflick/database";
import type { DrainController, ApplicationLogger } from "@pickflick/observability";

export const CONTACT_DELIVERY_MAX_ATTEMPTS = 5;
export const CONTACT_DELIVERY_POLL_MILLISECONDS = 5_000;

const retryDelaysMilliseconds = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

export interface ContactDeliveryRecord {
  readonly id: string;
  readonly message: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly attemptCount: number;
}

export abstract class ContactDeliveryStore {
  abstract claim(now: Date): Promise<ContactDeliveryRecord | undefined>;
  abstract complete(id: string, providerMessageId: string, now: Date): Promise<void>;
  abstract fail(id: string, errorCode: string, nextAttemptAt: Date | undefined): Promise<void>;
}

export abstract class ContactSender {
  abstract send(message: ContactDeliveryRecord): Promise<string>;
}

export class ContactProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super("Contact delivery provider request failed.");
    this.name = "ContactProviderError";
  }
}

export class PrismaContactDeliveryStore extends ContactDeliveryStore {
  constructor(
    private readonly database: ReturnType<typeof createDatabaseClient>,
    private readonly logger?: ApplicationLogger,
  ) {
    super();
  }

  async claim(now: Date): Promise<ContactDeliveryRecord | undefined> {
    const leaseUntil = new Date(now.getTime() + 60_000);
    const exhausted = await this.database.contactMessage.updateMany({
      where: {
        deliveryState: "PROCESSING",
        processingLeaseUntil: { lte: now },
        attemptCount: { gte: CONTACT_DELIVERY_MAX_ATTEMPTS },
      },
      data: {
        deliveryState: "FAILED",
        deliveryErrorCode: "LEASE_EXPIRED",
        processingLeaseUntil: null,
      },
    });
    if (exhausted.count > 0) {
      this.logger?.error(
        { event: "contact.delivery.lease_exhausted", messageCount: exhausted.count },
        "Contact delivery needs operator attention after an expired final-attempt lease.",
      );
    }
    const rows = await this.database.$queryRaw<ContactDeliveryRecord[]>`
      WITH candidate AS (
        SELECT "id"
        FROM "ContactMessage"
        WHERE (
          ("deliveryState" = 'PENDING' AND "nextAttemptAt" <= ${now})
          OR
          ("deliveryState" = 'PROCESSING' AND "processingLeaseUntil" <= ${now})
        )
        AND "attemptCount" < ${CONTACT_DELIVERY_MAX_ATTEMPTS}
        ORDER BY "nextAttemptAt", "createdAt"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "ContactMessage" AS message
      SET
        "deliveryState" = 'PROCESSING',
        "attemptCount" = message."attemptCount" + 1,
        "processingLeaseUntil" = ${leaseUntil},
        "deliveryErrorCode" = NULL,
        "updatedAt" = ${now}
      FROM candidate
      WHERE message."id" = candidate."id"
      RETURNING message."id", message."message", message."name", message."email", message."attemptCount"
    `;
    const record = rows[0];
    if (!record?.message) {
      return undefined;
    }
    return record;
  }

  async complete(id: string, providerMessageId: string, now: Date): Promise<void> {
    const result = await this.database.contactMessage.updateMany({
      where: { id, deliveryState: "PROCESSING" },
      data: {
        deliveryState: "DELIVERED",
        providerMessageId,
        deliveryErrorCode: null,
        processingLeaseUntil: null,
        deliveredAt: now,
        message: null,
        name: null,
        email: null,
      },
    });
    if (result.count !== 1) {
      throw new Error("Claimed Contact message was not available for completion.");
    }
  }

  async fail(id: string, errorCode: string, nextAttemptAt: Date | undefined): Promise<void> {
    const result = await this.database.contactMessage.updateMany({
      where: { id, deliveryState: "PROCESSING" },
      data: {
        deliveryState: nextAttemptAt ? "PENDING" : "FAILED",
        deliveryErrorCode: errorCode,
        processingLeaseUntil: null,
        ...(nextAttemptAt ? { nextAttemptAt } : {}),
      },
    });
    if (result.count !== 1) {
      throw new Error("Claimed Contact message was not available for failure recording.");
    }
  }
}

function plainTextBody(message: ContactDeliveryRecord): string {
  return [
    `Name: ${message.name ?? "Not provided"}`,
    `Email: ${message.email ?? "Not provided"}`,
    "",
    "Message:",
    message.message,
  ].join("\n");
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
      response = await this.request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.environment.resend.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": `contact-${message.id}`,
        },
        body: JSON.stringify({
          from: this.environment.resend.from,
          to: [this.environment.contact.deliveryTo],
          subject: "PickFlick contact message",
          text: plainTextBody(message),
          ...(this.environment.appEnvironment === "production"
            ? { reply_to: ["hello@pick-flick.app"] }
            : {}),
        }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new ContactProviderError("REQUEST_FAILED", true);
    }

    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new ContactProviderError(`HTTP_${response.status}`, retryable);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ContactProviderError("INVALID_RESPONSE", true);
    }
    const id = typeof body === "object" && body !== null && "id" in body ? body.id : undefined;
    if (typeof id !== "string" || !id || id.length > 200) {
      throw new ContactProviderError("INVALID_RESPONSE", true);
    }
    return id;
  }
}

function retryAt(attemptCount: number, now: Date): Date | undefined {
  const delay = retryDelaysMilliseconds[attemptCount - 1];
  return delay === undefined ? undefined : new Date(now.getTime() + delay);
}

export async function deliverNextContactMessage(
  store: ContactDeliveryStore,
  sender: ContactSender,
  logger: ApplicationLogger,
  now = new Date(),
): Promise<boolean> {
  const message = await store.claim(now);
  if (!message) {
    return false;
  }

  try {
    const providerMessageId = await sender.send(message);
    await store.complete(message.id, providerMessageId, now);
    logger.info(
      { event: "contact.delivery.completed", contactMessageId: message.id, attemptCount: message.attemptCount },
      "Contact message delivered.",
    );
  } catch (error) {
    const providerError = error instanceof ContactProviderError
      ? error
      : new ContactProviderError("DELIVERY_FAILED", true);
    const nextAttemptAt = providerError.retryable ? retryAt(message.attemptCount, now) : undefined;
    await store.fail(message.id, providerError.code, nextAttemptAt);
    logger.error(
      {
        event: "contact.delivery.failed",
        contactMessageId: message.id,
        attemptCount: message.attemptCount,
        errorCode: providerError.code,
        willRetry: Boolean(nextAttemptAt),
      },
      nextAttemptAt ? "Contact delivery will retry." : "Contact delivery needs operator attention.",
    );
  }
  return true;
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, CONTACT_DELIVERY_POLL_MILLISECONDS);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function runContactDeliveryLoop(
  signal: AbortSignal,
  store: ContactDeliveryStore,
  sender: ContactSender,
  logger: ApplicationLogger,
  drain: DrainController,
): Promise<void> {
  while (!signal.aborted) {
    const processed = await drain.run(() => deliverNextContactMessage(store, sender, logger));
    if (!processed) {
      await waitForPoll(signal);
    }
  }
}
