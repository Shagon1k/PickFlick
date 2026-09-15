import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { ContactSubmissionResponse } from "@pickflick/contracts";

import { keyedHash } from "../common/security/keyed-hash.js";
import { RUNTIME_ENVIRONMENT } from "../runtime.tokens.js";
import { CONTACT_RATE_LIMIT_MAX, CONTACT_RATE_LIMIT_WINDOW_SECONDS } from "./contact.constants.js";
import { ContactConflictError, ContactRateLimitError } from "./contact.errors.js";
import { ContactMessageRepository } from "./contact.repository.js";
import { parseContactSubmission } from "./contact.validation.js";

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
