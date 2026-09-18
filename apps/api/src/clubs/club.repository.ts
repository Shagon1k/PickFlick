import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
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

function canonicalUuid(value: string): string {
  return value.toLowerCase();
}

export abstract class ClubRepository {
  abstract readPolicySubject(userId: string, clubId: string): Promise<ClubPolicySubject>;
  abstract changeMembershipRole(input: ChangeMembershipRoleInput): Promise<ClubTransitionResult>;
  abstract transferAdministration(input: TransferAdministrationInput): Promise<ClubTransitionResult>;
}

@Injectable()
export class PrismaClubRepository extends ClubRepository {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async readPolicySubject(userId: string, clubId: string): Promise<ClubPolicySubject> {
    const canonicalUserId = canonicalUuid(userId);
    const canonicalClubId = canonicalUuid(clubId);
    const user = await this.database.client.user.findUnique({
      where: { id: canonicalUserId },
      select: {
        appRole: true,
        status: true,
        memberships: {
          where: { clubId: canonicalClubId, status: "ACTIVE" },
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
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    const targetMembershipId = canonicalUuid(input.targetMembershipId);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${clubId}`}, 0))`;

      const target = await transaction.membership.findUnique({
        where: { id: targetMembershipId },
        select: { clubId: true, id: true, role: true, status: true, userId: true },
      });
      const existing = await transaction.clubAuditEvent.findUnique({
        where: { operationId },
      });
      if (existing) {
        const replayActor = await transaction.user.findUnique({
          where: { id: actorUserId },
          select: { status: true },
        });
        if (replayActor?.status !== "ACTIVE") {
          throw new ClubAuthorizationError("The current User cannot manage Club roles.");
        }
        if (
          existing.action === "MEMBERSHIP_ROLE_CHANGED" &&
          existing.actorUserId === actorUserId &&
          existing.clubId === clubId &&
          existing.subjectMembershipId === targetMembershipId &&
          existing.nextRole === input.nextRole
        ) {
          return existing.changed
            ? { changed: true, auditEventId: existing.id, replayed: true }
            : { changed: false };
        }
        throw new ClubConflictError("The operation identifier was already used for another transition.");
      }

      const actor = await transaction.user.findUnique({
        where: { id: actorUserId },
        select: {
          status: true,
          memberships: {
            where: { clubId, status: "ACTIVE" },
            take: 1,
            select: { role: true, club: { select: { lifecycle: true } } },
          },
        },
      });
      if (actor?.status !== "ACTIVE" || actor.memberships[0]?.role !== "ADMIN") {
        throw new ClubAuthorizationError("The current User cannot manage Club roles.");
      }
      if (actor.memberships[0].club.lifecycle !== "ACTIVE") {
        throw new ClubConflictError("Archived Clubs do not allow Membership role changes.");
      }
      if (!target || target.clubId !== clubId || target.status !== "ACTIVE" || target.role === "ADMIN") {
        throw new ClubConflictError("The target is not an eligible active non-Admin Membership.");
      }
      if (target.role === input.nextRole) {
        await transaction.clubAuditEvent.create({
          data: {
            operationId,
            clubId,
            actorUserId,
            subjectUserId: target.userId,
            subjectMembershipId: target.id,
            action: "MEMBERSHIP_ROLE_CHANGED",
            changed: false,
            previousRole: target.role,
            nextRole: input.nextRole,
          },
        });
        return { changed: false };
      }

      await transaction.membership.update({
        where: { id: target.id },
        data: { role: input.nextRole },
      });
      const audit = await transaction.clubAuditEvent.create({
        data: {
          operationId,
          clubId,
          actorUserId,
          subjectUserId: target.userId,
          subjectMembershipId: target.id,
          action: "MEMBERSHIP_ROLE_CHANGED",
          changed: true,
          previousRole: target.role,
          nextRole: input.nextRole,
        },
        select: { id: true },
      });
      return { changed: true, auditEventId: audit.id, replayed: false };
    });
  }

  async transferAdministration(input: TransferAdministrationInput): Promise<ClubTransitionResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    const targetMembershipId = canonicalUuid(input.targetMembershipId);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${clubId}`}, 0))`;

      const target = await transaction.membership.findUnique({
        where: { id: targetMembershipId },
        select: {
          clubId: true,
          id: true,
          role: true,
          status: true,
          userId: true,
          user: { select: { status: true } },
        },
      });
      const existing = await transaction.clubAuditEvent.findUnique({
        where: { operationId },
      });
      if (existing) {
        const replayActor = await transaction.user.findUnique({
          where: { id: actorUserId },
          select: { appRole: true, status: true },
        });
        if (replayActor?.status !== "ACTIVE" || replayActor.appRole !== "APP_ADMIN") {
          throw new ClubAuthorizationError("The current User cannot transfer Club administration.");
        }
        if (
          existing.action === "ADMIN_TRANSFERRED" &&
          existing.actorUserId === actorUserId &&
          existing.clubId === clubId &&
          existing.subjectMembershipId === targetMembershipId &&
          existing.previousAdminNextRole === input.previousAdminNextRole
        ) {
          return { changed: true, auditEventId: existing.id, replayed: true };
        }
        throw new ClubConflictError("The operation identifier was already used for another transition.");
      }

      const actor = await transaction.user.findUnique({
        where: { id: actorUserId },
        select: { appRole: true, status: true },
      });
      if (actor?.status !== "ACTIVE" || actor.appRole !== "APP_ADMIN") {
        throw new ClubAuthorizationError("The current User cannot transfer Club administration.");
      }
      const currentAdmin = await transaction.membership.findFirst({
        where: { clubId, role: "ADMIN", status: "ACTIVE" },
        select: { id: true, userId: true },
      });
      if (
        !currentAdmin ||
        !target ||
        target.clubId !== clubId ||
        target.status !== "ACTIVE" ||
        target.user.status !== "ACTIVE" ||
        target.role === "ADMIN"
      ) {
        throw new ClubConflictError("The target is not an eligible active non-Admin Membership.");
      }

      await transaction.membership.update({
        where: { id: currentAdmin.id },
        data: { role: input.previousAdminNextRole },
      });
      await transaction.membership.update({
        where: { id: target.id },
        data: { role: "ADMIN" },
      });
      const audit = await transaction.clubAuditEvent.create({
        data: {
          operationId,
          clubId,
          actorUserId,
          subjectUserId: target.userId,
          subjectMembershipId: target.id,
          action: "ADMIN_TRANSFERRED",
          changed: true,
          previousRole: target.role,
          nextRole: "ADMIN",
          previousAdminUserId: currentAdmin.userId,
          previousAdminNextRole: input.previousAdminNextRole,
        },
        select: { id: true },
      });
      return { changed: true, auditEventId: audit.id, replayed: false };
    });
  }
}
