import { Inject, OnModuleDestroy } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { createDatabaseClient } from "@pickflick/database";

import { RUNTIME_ENVIRONMENT } from "../runtime.tokens.js";
import type { AcceptContactMessageInput, ContactAcceptance } from "./contact.types.js";

export abstract class ContactMessageRepository {
  abstract accept(
    input: AcceptContactMessageInput,
    recentSince: Date,
    limit: number,
  ): Promise<ContactAcceptance>;
}

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
