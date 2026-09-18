import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import type { AcceptContactMessageInput, ContactAcceptance } from "./contact.types.js";

export abstract class ContactMessageRepository {
  abstract accept(
    input: AcceptContactMessageInput,
    recentSince: Date,
    limit: number,
  ): Promise<ContactAcceptance>;
}

@Injectable()
export class PrismaContactMessageRepository extends ContactMessageRepository {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async accept(
    input: AcceptContactMessageInput,
    recentSince: Date,
    limit: number,
  ): Promise<ContactAcceptance> {
    return this.database.client.$transaction(async (transaction) => {
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

}
