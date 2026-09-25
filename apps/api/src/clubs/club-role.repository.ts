import { Injectable } from "@nestjs/common";

import { canonicalUuid } from "../common/validation/uuid.js";
import { lockKeys } from "../database/advisory-lock.js";
import { DatabaseService } from "../database/database.service.js";
import { ClubAuthorizationError, ClubConflictError } from "./club.errors.js";
import { assertClubOperationReplay } from "./club-operation-replay.js";

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

export interface ClubTransitionResult {
  readonly changed: boolean;
  readonly replayed: boolean;
  readonly auditEventId?: string;
}

interface HashedInput {
  readonly requestHash: string;
}

/** Audited Club role transitions: Admin-managed Moderator/Member changes and App Admin transfers. */
export abstract class ClubRoleRepository {
  abstract changeMembershipRole(input: ChangeMembershipRoleInput & HashedInput): Promise<ClubTransitionResult>;
  abstract transferAdministration(input: TransferAdministrationInput & HashedInput): Promise<ClubTransitionResult>;
}

@Injectable()
export class PrismaClubRoleRepository extends ClubRoleRepository {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async changeMembershipRole(input: ChangeMembershipRoleInput & HashedInput): Promise<ClubTransitionResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    const targetMembershipId = canonicalUuid(input.targetMembershipId);
    return this.database.client.$transaction(async (transaction) => {
      await lockKeys(transaction, `club-operation:${operationId}`, `club:${clubId}`);
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (existing) {
        await assertClubOperationReplay(transaction, existing, {
          action: "MEMBERSHIP_ROLE_CHANGED",
          actorUserId,
          clubId,
          requestHash: input.requestHash,
        });
        return existing.changed
          ? { changed: true, auditEventId: existing.id, replayed: true }
          : { changed: false, replayed: true };
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
        throw new ClubConflictError("CLUB_ARCHIVED", "Archived Clubs do not allow Membership role changes.");
      }
      const target = await transaction.membership.findUnique({
        where: { id: targetMembershipId },
        select: { clubId: true, id: true, role: true, status: true, userId: true },
      });
      if (!target || target.clubId !== clubId || target.status !== "ACTIVE" || target.role === "ADMIN") {
        throw new ClubConflictError("MEMBERSHIP_INELIGIBLE", "The target is not an eligible active non-Admin Membership.");
      }

      const changed = target.role !== input.nextRole;
      if (changed) {
        await transaction.membership.update({
          where: { id: target.id },
          data: { role: input.nextRole },
        });
      }
      const audit = await transaction.clubAuditEvent.create({
        data: {
          operationId,
          requestHash: input.requestHash,
          clubId,
          actorUserId,
          subjectUserId: target.userId,
          subjectMembershipId: target.id,
          action: "MEMBERSHIP_ROLE_CHANGED",
          changed,
          previousRole: target.role,
          nextRole: input.nextRole,
        },
        select: { id: true },
      });
      return changed
        ? { changed: true, auditEventId: audit.id, replayed: false }
        : { changed: false, replayed: false };
    });
  }

  async transferAdministration(input: TransferAdministrationInput & HashedInput): Promise<ClubTransitionResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    const targetMembershipId = canonicalUuid(input.targetMembershipId);
    return this.database.client.$transaction(async (transaction) => {
      await lockKeys(transaction, `club-operation:${operationId}`, `club:${clubId}`);
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (existing) {
        await assertClubOperationReplay(transaction, existing, {
          action: "ADMIN_TRANSFERRED",
          actorUserId,
          clubId,
          requestHash: input.requestHash,
          requiresAppAdmin: true,
        });
        return { changed: true, auditEventId: existing.id, replayed: true };
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
      if (
        !currentAdmin ||
        !target ||
        target.clubId !== clubId ||
        target.status !== "ACTIVE" ||
        target.user.status !== "ACTIVE" ||
        target.role === "ADMIN"
      ) {
        throw new ClubConflictError("MEMBERSHIP_INELIGIBLE", "The target is not an eligible active non-Admin Membership.");
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
          requestHash: input.requestHash,
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
