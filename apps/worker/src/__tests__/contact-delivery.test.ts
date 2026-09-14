import { Writable } from "node:stream";

import type { WorkerEnvironment } from "@pickflick/config/environment";
import { createLogger } from "@pickflick/observability";
import { describe, expect, it, vi } from "vitest";

import {
  ContactDeliveryStore,
  ContactProviderError,
  ContactSender,
  deliverNextContactMessage,
  ResendContactSender,
  type ContactDeliveryRecord,
} from "../contact-delivery.js";

const privateMessage = "private-contact-message-marker";
const record: ContactDeliveryRecord = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  message: privateMessage,
  name: "Jane Doe",
  email: "jane@example.invalid",
  attemptCount: 1,
};

const environment = {
  appEnvironment: "production",
  resend: { apiKey: "test-resend-key", from: "PickFlick <notifications@pick-flick.app>" },
  contact: {
    deliveryTo: "hello@pick-flick.app",
    hashSecret: "test-contact-hash-secret-at-least-32-characters",
  },
} as WorkerEnvironment;

class FakeStore extends ContactDeliveryStore {
  message: ContactDeliveryRecord | undefined = record;
  readonly completed: Array<{ id: string; providerMessageId: string }> = [];
  readonly failed: Array<{ id: string; errorCode: string; nextAttemptAt?: Date }> = [];

  async claim() {
    return this.message;
  }

  async complete(id: string, providerMessageId: string) {
    this.completed.push({ id, providerMessageId });
  }

  async fail(id: string, errorCode: string, nextAttemptAt: Date | undefined) {
    this.failed.push({ id, errorCode, ...(nextAttemptAt ? { nextAttemptAt } : {}) });
  }
}

class FakeSender extends ContactSender {
  error?: Error;

  async send() {
    if (this.error) {
      throw this.error;
    }
    return "provider-message-id";
  }
}

function captureLogger() {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return {
    logger: createLogger({ service: "worker", environment: "test", destination }),
    output: () => output,
  };
}

describe("Contact delivery", () => {
  it("sends plain text with a stable provider idempotency key", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: "provider-message-id" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(new ResendContactSender(environment, request).send(record)).resolves.toBe("provider-message-id");
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options?.headers).toMatchObject({ "idempotency-key": `contact-${record.id}` });
    const body = JSON.parse(String(options?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: environment.resend.from,
      to: ["hello@pick-flick.app"],
      reply_to: ["hello@pick-flick.app"],
      text: expect.stringContaining(privateMessage),
    });
    expect(body).not.toHaveProperty("html");
  });

  it("omits the production reply address outside production", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: "provider-message-id" }), { status: 200 }));
    const uatEnvironment = { ...environment, appEnvironment: "uat" } as WorkerEnvironment;

    await new ResendContactSender(uatEnvironment, request).send(record);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).not.toHaveProperty("reply_to");
  });

  it.each([
    [429, true],
    [503, true],
    [422, false],
  ])("classifies provider HTTP %s without reading or logging its body", async (status, retryable) => {
    const request = vi.fn<typeof fetch>(async () => new Response(privateMessage, { status }));

    await expect(new ResendContactSender(environment, request).send(record)).rejects.toMatchObject({
      code: `HTTP_${status}`,
      retryable,
    });
  });

  it("completes successful delivery without logging message content", async () => {
    const store = new FakeStore();
    const logs = captureLogger();

    await expect(deliverNextContactMessage(store, new FakeSender(), logs.logger)).resolves.toBe(true);
    expect(store.completed).toEqual([{ id: record.id, providerMessageId: "provider-message-id" }]);
    expect(store.failed).toEqual([]);
    expect(logs.output()).toContain('"event":"contact.delivery.completed"');
    expect(logs.output()).not.toContain(privateMessage);
  });

  it("records bounded retry state for a retryable provider failure", async () => {
    const store = new FakeStore();
    const sender = new FakeSender();
    const logs = captureLogger();
    const now = new Date("2026-09-14T12:00:00.000Z");
    sender.error = new ContactProviderError("HTTP_503", true);

    await deliverNextContactMessage(store, sender, logs.logger, now);
    expect(store.failed).toEqual([{
      id: record.id,
      errorCode: "HTTP_503",
      nextAttemptAt: new Date("2026-09-14T12:01:00.000Z"),
    }]);
    expect(logs.output()).toContain('"willRetry":true');
    expect(logs.output()).not.toContain(privateMessage);
  });

  it("stops retrying permanent failures and exhausted messages", async () => {
    const permanentStore = new FakeStore();
    const permanentSender = new FakeSender();
    permanentSender.error = new ContactProviderError("HTTP_422", false);
    await deliverNextContactMessage(permanentStore, permanentSender, captureLogger().logger);
    expect(permanentStore.failed[0]).toEqual({ id: record.id, errorCode: "HTTP_422" });

    const exhaustedStore = new FakeStore();
    exhaustedStore.message = { ...record, attemptCount: 5 };
    const exhaustedSender = new FakeSender();
    exhaustedSender.error = new ContactProviderError("HTTP_503", true);
    await deliverNextContactMessage(exhaustedStore, exhaustedSender, captureLogger().logger);
    expect(exhaustedStore.failed[0]).toEqual({ id: record.id, errorCode: "HTTP_503" });
  });

  it("does no work when no retryable Contact message is due", async () => {
    const store = new FakeStore();
    store.message = undefined;
    await expect(deliverNextContactMessage(store, new FakeSender(), captureLogger().logger)).resolves.toBe(false);
  });
});
