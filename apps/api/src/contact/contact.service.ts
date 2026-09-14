import { createHmac, randomUUID } from "node:crypto";

import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  type ContactSubmissionRequest,
  type ContactSubmissionResponse,
} from "@pickflick/contracts";
import { createDatabaseClient } from "@pickflick/database";

import { RUNTIME_ENVIRONMENT } from "../runtime.tokens.js";

export const CONTACT_RATE_LIMIT_MAX = 5;
export const CONTACT_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

interface NormalizedContactSubmission extends ContactSubmissionRequest {
  readonly name?: string;
  readonly email?: string;
}

export interface AcceptContactMessageInput extends NormalizedContactSubmission {
  readonly id: string;
  readonly sourceHash: string;
  readonly contentHash: string;
}

export type ContactAcceptance =
  | { readonly kind: "accepted"; readonly id: string }
  | { readonly kind: "duplicate"; readonly id: string }
  | { readonly kind: "conflict" }
  | { readonly kind: "rate_limited" };

export abstract class ContactMessageRepository {
  abstract accept(
    input: AcceptContactMessageInput,
    recentSince: Date,
    limit: number,
  ): Promise<ContactAcceptance>;
}

export class ContactValidationError extends Error {
  constructor() {
    super("Contact submission validation failed.");
    this.name = "ContactValidationError";
  }
}

export class ContactConflictError extends Error {
  constructor() {
    super("The submission key is already associated with different content.");
    this.name = "ContactConflictError";
  }
}

export class ContactRateLimitError extends Error {
  readonly retryAfterSeconds = CONTACT_RATE_LIMIT_WINDOW_SECONDS;

  constructor() {
    super("The Contact submission rate limit was reached.");
    this.name = "ContactRateLimitError";
  }
}

function optionalString(value: unknown, maxLength: number, singleLine: boolean): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ContactValidationError();
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || hasUnsafeControlCharacter(normalized)) {
    throw new ContactValidationError();
  }
  if (singleLine && /[\r\n]/.test(normalized)) {
    throw new ContactValidationError();
  }
  return normalized;
}

function hasUnsafeControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (code < 32 && code !== 9 && code !== 10) || code === 127;
  });
}

export function parseContactSubmission(value: unknown): NormalizedContactSubmission {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContactValidationError();
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["submissionKey", "message", "name", "email"].includes(key))) {
    throw new ContactValidationError();
  }
  if (typeof input.submissionKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.submissionKey)) {
    throw new ContactValidationError();
  }
  if (typeof input.message !== "string") {
    throw new ContactValidationError();
  }
  const message = input.message.replace(/\r\n?/g, "\n").trim();
  if (
    !message ||
    message.length > CONTACT_MESSAGE_MAX_LENGTH ||
    hasUnsafeControlCharacter(message)
  ) {
    throw new ContactValidationError();
  }
  const name = optionalString(input.name, CONTACT_NAME_MAX_LENGTH, true);
  const email = optionalString(input.email, CONTACT_EMAIL_MAX_LENGTH, true)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ContactValidationError();
  }
  return {
    submissionKey: input.submissionKey.toLowerCase(),
    message,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  };
}

function keyedHash(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

@Injectable()
export class PrismaContactMessageRepository extends ContactMessageRepository implements OnModuleDestroy {
  private readonly database;

  constructor(@Inject(RUNTIME_ENVIRONMENT) environment: RuntimeEnvironment) {
    super();
    this.database = createDatabaseClient(environment.databaseUrl);
  }

  async accept(
    input: AcceptContactMessageInput,
    recentSince: Date,
    limit: number,
  ): Promise<ContactAcceptance> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`contact-key:${input.submissionKey}`}, 0))`;
      const existing = await transaction.contactMessage.findUnique({
        where: { submissionKey: input.submissionKey },
        select: { id: true, contentHash: true },
      });
      if (existing) {
        return existing.contentHash === input.contentHash
          ? { kind: "duplicate" as const, id: existing.id }
          : { kind: "conflict" as const };
      }

      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`contact-source:${input.sourceHash}`}, 0))`;
      const recentCount = await transaction.contactMessage.count({
        where: { sourceHash: input.sourceHash, createdAt: { gte: recentSince } },
      });
      if (recentCount >= limit) {
        return { kind: "rate_limited" as const };
      }

      const created = await transaction.contactMessage.create({
        data: {
          id: input.id,
          submissionKey: input.submissionKey,
          sourceHash: input.sourceHash,
          contentHash: input.contentHash,
          message: input.message,
          ...(input.name ? { name: input.name } : {}),
          ...(input.email ? { email: input.email } : {}),
        },
        select: { id: true },
      });
      return { kind: "accepted" as const, id: created.id };
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }
}

@Injectable()
export class ContactService {
  constructor(
    private readonly repository: ContactMessageRepository,
    @Inject(RUNTIME_ENVIRONMENT) private readonly environment: RuntimeEnvironment,
  ) {}

  async submit(body: unknown, sourceAddress: string, now = new Date()): Promise<ContactSubmissionResponse> {
    const submission = parseContactSubmission(body);
    const contentHash = keyedHash(
      this.environment.contact.hashSecret,
      JSON.stringify({ message: submission.message, name: submission.name ?? null, email: submission.email ?? null }),
    );
    const acceptance = await this.repository.accept(
      {
        ...submission,
        id: randomUUID(),
        sourceHash: keyedHash(this.environment.contact.hashSecret, sourceAddress),
        contentHash,
      },
      new Date(now.getTime() - CONTACT_RATE_LIMIT_WINDOW_SECONDS * 1_000),
      CONTACT_RATE_LIMIT_MAX,
    );

    if (acceptance.kind === "conflict") {
      throw new ContactConflictError();
    }
    if (acceptance.kind === "rate_limited") {
      throw new ContactRateLimitError();
    }
    return { id: acceptance.id, status: acceptance.kind };
  }
}
