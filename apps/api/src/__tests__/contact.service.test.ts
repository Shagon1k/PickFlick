import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { describe, expect, it } from "vitest";

import {
  CONTACT_RATE_LIMIT_MAX,
  CONTACT_RATE_LIMIT_WINDOW_SECONDS,
} from "../contact/contact.constants.js";
import {
  ContactConflictError,
  ContactRateLimitError,
  ContactValidationError,
} from "../contact/contact.errors.js";
import { ContactMessageRepository } from "../contact/contact.repository.js";
import { ContactService } from "../contact/contact.service.js";
import type {
  AcceptContactMessageInput,
  ContactAcceptance,
} from "../contact/contact.types.js";
import { parseContactSubmission } from "../contact/contact.validation.js";

const environment = {
  contact: {
    deliveryTo: "contact@example.invalid",
    hashSecret: "test-contact-hash-secret-at-least-32-characters",
  },
} as RuntimeEnvironment;

const validSubmission = {
  submissionKey: "123e4567-e89b-42d3-a456-426614174000", // gitleaks:allow -- synthetic UUID fixture
  message: "A concise message.",
  name: "Jane Doe",
  email: "JANE@example.invalid",
};

class FakeRepository extends ContactMessageRepository {
  readonly calls: Array<{ input: AcceptContactMessageInput; limit: number; recentSince: Date }> = [];
  result: ContactAcceptance = { kind: "accepted", id: "contact-1" };

  async accept(input: AcceptContactMessageInput, recentSince: Date, limit: number) {
    this.calls.push({ input, recentSince, limit });
    return this.result;
  }
}

describe("Contact submission boundary", () => {
  it("normalizes safe input and rejects extra or unsafe fields", () => {
    expect(parseContactSubmission({ ...validSubmission, message: "  hello\r\nworld  " })).toEqual({
      ...validSubmission,
      email: "jane@example.invalid",
      message: "hello\nworld",
    });
    expect(() => parseContactSubmission({ ...validSubmission, internalRole: "admin" })).toThrow(ContactValidationError);
    expect(() => parseContactSubmission({ ...validSubmission, name: "Jane\nBcc: person@example.invalid" })).toThrow(
      ContactValidationError,
    );
  });

  it.each([
    {},
    { ...validSubmission, submissionKey: "not-a-uuid" },
    { ...validSubmission, message: "   " },
    { ...validSubmission, message: "x".repeat(501) },
    { ...validSubmission, message: "unsafe\u0000content" },
    { ...validSubmission, name: "x".repeat(101) },
    { ...validSubmission, email: "not-an-email" },
  ])("rejects invalid input without partial acceptance", (input) => {
    expect(() => parseContactSubmission(input)).toThrow(ContactValidationError);
  });

  it("accepts a normalized message with keyed, non-reversible hashes", async () => {
    const repository = new FakeRepository();
    const service = new ContactService(repository, environment);
    const now = new Date("2026-09-14T12:00:00.000Z");

    await expect(service.submit(validSubmission, "203.0.113.42", now)).resolves.toEqual({
      id: "contact-1",
      status: "accepted",
    });
    expect(repository.calls).toHaveLength(1);
    expect(repository.calls[0]).toMatchObject({
      input: {
        message: validSubmission.message,
        name: validSubmission.name,
        email: "jane@example.invalid",
        submissionKey: validSubmission.submissionKey,
        sourceHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      limit: CONTACT_RATE_LIMIT_MAX,
      recentSince: new Date(now.getTime() - CONTACT_RATE_LIMIT_WINDOW_SECONDS * 1_000),
    });
    expect(JSON.stringify(repository.calls[0]?.input)).not.toContain("203.0.113.42");
  });

  it("returns an explicit duplicate result for a safe retry", async () => {
    const repository = new FakeRepository();
    repository.result = { kind: "duplicate", id: "contact-original" };

    await expect(new ContactService(repository, environment).submit(validSubmission, "203.0.113.42")).resolves.toEqual({
      id: "contact-original",
      status: "duplicate",
    });
  });

  it("rejects a reused key with changed content", async () => {
    const repository = new FakeRepository();
    repository.result = { kind: "conflict" };

    await expect(new ContactService(repository, environment).submit(validSubmission, "203.0.113.42")).rejects.toThrow(
      ContactConflictError,
    );
  });

  it("rejects a source that reached the fixed rate window", async () => {
    const repository = new FakeRepository();
    repository.result = { kind: "rate_limited" };

    await expect(new ContactService(repository, environment).submit(validSubmission, "203.0.113.42")).rejects.toMatchObject({
      name: ContactRateLimitError.name,
      retryAfterSeconds: CONTACT_RATE_LIMIT_WINDOW_SECONDS,
    });
  });
});
