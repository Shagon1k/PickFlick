import { Inject, OnModuleDestroy } from "@nestjs/common";
import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { createDatabaseClient } from "@pickflick/database";

import { RUNTIME_ENVIRONMENT } from "../runtime.tokens.js";
import { ClubAuthorizationError, ClubConflictError } from "./club.errors.js";
import type { ClubPolicySubject } from "./club-policy.js";

export interface ChangeMembershipRoleInput {
  readonly actorUserId: string;
  readonly clubId: string;
  readonly nextRole: "MODERATOR" | "MEMBER";
  readonly operationId: string;
  readonly targetMembershipId: string;
}

export interface TransferAdministrationInput {
  readonly actorUserId: string;
  readonly clubId: string;
  readonly operationId: string;
  readonly previousAdminNextRole: "MODERATOR" | "MEMBER";
  readonly targetMembershipId: string;
}

export type ClubTransitionResult =
  | { readonly changed: false }
  | { readonly changed: true; readonly auditEventId: string; readonly replayed: boolean };

export abstract class ClubRepository {
  abstract readPolicySubject(userId: string, clubId: string): Promise<ClubPolicySubject>;
  abstract changeMembershipRole(input: ChangeMembershipRoleInput): Promise<ClubTransitionResult>;
  abstract transferAdministration(input: TransferAdministrationInput): Promise<ClubTransitionResult>;
}

export class PrismaClubRepository extends ClubRepository implements OnModuleDestroy {
  private readonly database;

  constructor(@Inject(RUNTIME_ENVIRONMENT) environment: Pick<RuntimeEnvironment, "databaseUrl">) {
    super();
    this.database = createDatabaseClient(environment.databaseUrl);
  }

  async readPolicySubject(userId: string, clubId: string): Promise<ClubPolicySubject> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        appRole: true,
        status: true,
        memberships: {
          where: { clubId, status: "ACTIVE" },
          take: 1,
          select: { role: true, club: { select: { lifecycle: true } } },
        },
      },
    });
    const membership = user?.memberships[0];
    return {
      appRole: user?.appRole ?? "USER",
      clubRole: membership?.role ?? null,
      lifecycle: membership?.club.lifecycle ?? null,
      userStatus: user?.status ?? "ANONYMIZED",
    };
  }

  async changeMembershipRole(input: ChangeMembershipRoleInput): Promise<ClubTransitionResult> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${input.operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${input.clubId}`}, 0))`;

      const target = await transaction.membership.findUnique({
        where: { id: input.targetMembershipId },
        select: { clubId: true, id: true, role: true, status: true, userId: true },
      });
      const existing = await transaction.clubAuditEvent.findUnique({
        where: { operationId: input.operationId },
      });
      if (existing) {
        const replayActor = await transaction.user.findUnique({
          where: { id: input.actorUserId },
          select: { status: true },
        });
        if (replayActor?.status !== "ACTIVE") {
          throw new ClubAuthorizationError("The current User cannot manage Club roles.");
        }
        if (
          existing.action === "MEMBERSHIP_ROLE_CHANGED" &&
          existing.actorUserId === input.actorUserId &&
          existing.clubId === input.clubId &&
          existing.subjectMembershipId === input.targetMembershipId &&
          existing.nextRole === input.nextRole
        ) {
          return { changed: true, auditEventId: existing.id, replayed: true };
        }
        throw new ClubConflictError("The operation identifier was already used for another transition.");
      }

      const actor = await transaction.user.findUnique({
        where: { id: input.actorUserId },
        select: {
          status: true,
          memberships: {
            where: { clubId: input.clubId, status: "ACTIVE" },
            take: 1,
            select: { role: true },
          },
        },
      });
      if (actor?.status !== "ACTIVE" || actor.memberships[0]?.role !== "ADMIN") {
        throw new ClubAuthorizationError("The current User cannot manage Club roles.");
      }
      if (!target || target.clubId !== input.clubId || target.status !== "ACTIVE" || target.role === "ADMIN") {
        throw new ClubConflictError("The target is not an eligible active non-Admin Membership.");
      }
      if (target.role === input.nextRole) {
        return { changed: false };
      }

      await transaction.membership.update({
        where: { id: target.id },
        data: { role: input.nextRole },
      });
      const audit = await transaction.clubAuditEvent.create({
        data: {
          operationId: input.operationId,
          clubId: input.clubId,
          actorUserId: input.actorUserId,
          subjectUserId: target.userId,
          subjectMembershipId: target.id,
          action: "MEMBERSHIP_ROLE_CHANGED",
          previousRole: target.role,
          nextRole: input.nextRole,
        },
        select: { id: true },
      });
      return { changed: true, auditEventId: audit.id, replayed: false };
    });
  }

  async transferAdministration(input: TransferAdministrationInput): Promise<ClubTransitionResult> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${input.operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${input.clubId}`}, 0))`;

      const target = await transaction.membership.findUnique({
        where: { id: input.targetMembershipId },
        select: { clubId: true, id: true, role: true, status: true, userId: true },
      });
      const existing = await transaction.clubAuditEvent.findUnique({
        where: { operationId: input.operationId },
      });
      if (existing) {
        const replayActor = await transaction.user.findUnique({
          where: { id: input.actorUserId },
          select: { status: true },
        });
        if (replayActor?.status !== "ACTIVE") {
          throw new ClubAuthorizationError("The current User cannot transfer Club administration.");
        }
        if (
          existing.action === "ADMIN_TRANSFERRED" &&
          existing.actorUserId === input.actorUserId &&
          existing.clubId === input.clubId &&
          existing.subjectMembershipId === input.targetMembershipId &&
          existing.previousAdminNextRole === input.previousAdminNextRole
        ) {
          return { changed: true, auditEventId: existing.id, replayed: true };
        }
        throw new ClubConflictError("The operation identifier was already used for another transition.");
      }

      const actor = await transaction.user.findUnique({
        where: { id: input.actorUserId },
        select: {
          status: true,
          memberships: {
            where: { clubId: input.clubId, status: "ACTIVE" },
            take: 1,
            select: { id: true, role: true },
          },
        },
      });
      const actorMembership = actor?.memberships[0];
      if (actor?.status !== "ACTIVE" || actorMembership?.role !== "ADMIN") {
        throw new ClubAuthorizationError("The current User cannot transfer Club administration.");
      }
      if (
        !target ||
        target.clubId !== input.clubId ||
        target.status !== "ACTIVE" ||
        target.role === "ADMIN" ||
        target.id === actorMembership.id
      ) {
        throw new ClubConflictError("The target is not an eligible active non-Admin Membership.");
      }

      await transaction.membership.update({
        where: { id: actorMembership.id },
        data: { role: input.previousAdminNextRole },
      });
      await transaction.membership.update({
        where: { id: target.id },
        data: { role: "ADMIN" },
      });
      const audit = await transaction.clubAuditEvent.create({
        data: {
          operationId: input.operationId,
          clubId: input.clubId,
          actorUserId: input.actorUserId,
          subjectUserId: target.userId,
          subjectMembershipId: target.id,
          action: "ADMIN_TRANSFERRED",
          previousRole: target.role,
          nextRole: "ADMIN",
          previousAdminUserId: input.actorUserId,
          previousAdminNextRole: input.previousAdminNextRole,
        },
        select: { id: true },
      });
      return { changed: true, auditEventId: audit.id, replayed: false };
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }
}
