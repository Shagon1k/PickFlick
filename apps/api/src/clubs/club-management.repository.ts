import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@pickflick/database";

import { DatabaseService } from "../database/database.service.js";
import { ClubAuthorizationError, ClubConflictError } from "./club.errors.js";
import type {
  ClubLifecycleInput,
  DeleteClubInput,
  FindAvatarReplayInput,
  LeaveClubInput,
  PersistClubSettingsInput,
  StoredClubManagementView,
  UpdateAvatarReferenceInput,
} from "./club-management.types.js";

export interface ClubManagementResult {
  readonly changed: boolean;
  readonly replayed: boolean;
}

export interface ClubAvatarReferenceResult extends ClubManagementResult {
  readonly currentObjectKey?: string;
  readonly previousObjectKey?: string;
}

export abstract class ClubManagementRepository {
  abstract readForUser(userId: string, clubId: string): Promise<StoredClubManagementView | null>;
  abstract updateSettings(input: PersistClubSettingsInput): Promise<ClubManagementResult>;
  abstract changeLifecycle(input: ClubLifecycleInput): Promise<ClubManagementResult>;
  abstract leave(input: LeaveClubInput): Promise<ClubManagementResult>;
  abstract delete(input: DeleteClubInput): Promise<ClubAvatarReferenceResult>;
  abstract findAvatarReplay(input: FindAvatarReplayInput): Promise<ClubAvatarReferenceResult | null>;
  abstract updateAvatarReference(input: UpdateAvatarReferenceInput): Promise<ClubAvatarReferenceResult>;
}

function canonicalUuid(value: string): string {
  return value.toLowerCase();
}

function avatarVersion(objectKey: string): string {
  return createHash("sha256").update(objectKey).digest("hex").slice(0, 16);
}

@Injectable()
export class PrismaClubManagementRepository extends ClubManagementRepository {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async readForUser(userId: string, clubId: string): Promise<StoredClubManagementView | null> {
    const canonicalUserId = canonicalUuid(userId);
    const canonicalClubId = canonicalUuid(clubId);
    const user = await this.database.client.user.findUnique({
      where: { id: canonicalUserId },
      select: {
        appRole: true,
        status: true,
        memberships: {
          where: { clubId: canonicalClubId, status: "ACTIVE", club: { deletedAt: null } },
          take: 1,
          select: {
            role: true,
            club: {
              select: {
                id: true,
                name: true,
                description: true,
                avatarObjectKey: true,
                lifecycle: true,
                selectionScaleMin: true,
                selectionScaleMax: true,
                showNominationAuthors: true,
                showNominationsBeforeSubmit: true,
                showVoteResults: true,
                showRatingResults: true,
                useMonochromeMedia: true,
                memberships: {
                  where: { status: "ACTIVE" },
                  orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
                  select: {
                    id: true,
                    role: true,
                    joinedAt: true,
                    user: { select: { displayName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const membership = user?.memberships[0];
    if (!user || user.status !== "ACTIVE" || !membership) {
      return null;
    }
    const club = membership.club;
    const auditEvents = membership.role === "ADMIN"
      ? await this.database.client.clubAuditEvent.findMany({
          where: { clubId: canonicalClubId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            action: true,
            changed: true,
            createdAt: true,
          },
        })
      : [];
    return {
      subject: {
        appRole: user.appRole,
        clubRole: membership.role,
        lifecycle: club.lifecycle,
        userStatus: user.status,
      },
      club: {
        id: club.id,
        name: club.name,
        ...(club.description ? { description: club.description } : {}),
        hasAvatar: Boolean(club.avatarObjectKey),
        ...(club.avatarObjectKey ? { avatarVersion: avatarVersion(club.avatarObjectKey) } : {}),
        lifecycle: club.lifecycle,
        membershipRole: membership.role,
        selectionScaleMin: club.selectionScaleMin as 0 | 1,
        selectionScaleMax: club.selectionScaleMax,
      },
      visibility: {
        showNominationAuthors: club.showNominationAuthors,
        showNominationsBeforeSubmit: club.showNominationsBeforeSubmit,
        showVoteResults: club.showVoteResults,
        showRatingResults: club.showRatingResults,
        useMonochromeMedia: club.useMonochromeMedia,
      },
      members: club.memberships.map((current) => ({
        id: current.id,
        displayName: current.user.displayName,
        role: current.role,
        joinedAt: current.joinedAt.toISOString(),
      })),
      auditEvents: auditEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
      ...(club.avatarObjectKey ? { avatarObjectKey: club.avatarObjectKey } : {}),
    };
  }

  async updateSettings(input: PersistClubSettingsInput): Promise<ClubManagementResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${clubId}`}, 0))`;
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (existing) {
        await this.assertReplay(transaction, existing, actorUserId, clubId, "CLUB_SETTINGS_UPDATED", input.requestHash);
        return { changed: existing.changed, replayed: true };
      }
      const actor = await this.activeAdmin(transaction, actorUserId, clubId, true);
      const club = actor.club;
      const changed =
        club.name !== input.name ||
        (club.description ?? undefined) !== input.description ||
        club.selectionScaleMin !== input.selectionScaleMin ||
        club.selectionScaleMax !== input.selectionScaleMax ||
        club.showNominationAuthors !== input.showNominationAuthors ||
        club.showNominationsBeforeSubmit !== input.showNominationsBeforeSubmit ||
        club.showVoteResults !== input.showVoteResults ||
        club.showRatingResults !== input.showRatingResults ||
        club.useMonochromeMedia !== input.useMonochromeMedia;
      if (changed) {
        await transaction.club.update({
          where: { id: clubId },
          data: {
            name: input.name,
            description: input.description ?? null,
            selectionScaleMin: input.selectionScaleMin,
            selectionScaleMax: input.selectionScaleMax,
            showNominationAuthors: input.showNominationAuthors,
            showNominationsBeforeSubmit: input.showNominationsBeforeSubmit,
            showVoteResults: input.showVoteResults,
            showRatingResults: input.showRatingResults,
            useMonochromeMedia: input.useMonochromeMedia,
          },
        });
      }
      await transaction.clubAuditEvent.create({
        data: {
          operationId,
          requestHash: input.requestHash,
          clubId,
          actorUserId,
          subjectUserId: actorUserId,
          subjectMembershipId: actor.membershipId,
          action: "CLUB_SETTINGS_UPDATED",
          changed,
        },
      });
      return { changed, replayed: false };
    });
  }

  async changeLifecycle(input: ClubLifecycleInput): Promise<ClubManagementResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    const auditAction = input.action === "archive" ? "CLUB_ARCHIVED" : "CLUB_REACTIVATED";
    const nextLifecycle = input.action === "archive" ? "ARCHIVED" : "ACTIVE";
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${operationId}`}, 0))`;
      if (input.action === "reactivate") {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-creation:${actorUserId}`}, 0))`;
      }
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${clubId}`}, 0))`;
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (existing) {
        await this.assertReplay(transaction, existing, actorUserId, clubId, auditAction, input.requestHash);
        return { changed: existing.changed, replayed: true };
      }
      const actor = await this.activeAdmin(transaction, actorUserId, clubId, false);
      const previousLifecycle = actor.club.lifecycle;
      const changed = previousLifecycle !== nextLifecycle;
      if (changed && input.action === "reactivate") {
        const activeAdminClubCount = await transaction.membership.count({
          where: {
            userId: actorUserId,
            role: "ADMIN",
            status: "ACTIVE",
            club: { deletedAt: null, lifecycle: "ACTIVE" },
          },
        });
        if (activeAdminClubCount >= input.adminClubLimit) {
          throw new ClubConflictError("The current User has reached the administered Club limit.");
        }
      }
      if (changed) {
        await transaction.club.update({ where: { id: clubId }, data: { lifecycle: nextLifecycle } });
      }
      await transaction.clubAuditEvent.create({
        data: {
          operationId,
          requestHash: input.requestHash,
          clubId,
          actorUserId,
          subjectUserId: actorUserId,
          subjectMembershipId: actor.membershipId,
          action: auditAction,
          changed,
          previousLifecycle,
          nextLifecycle,
        },
      });
      return { changed, replayed: false };
    });
  }

  async leave(input: LeaveClubInput): Promise<ClubManagementResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${clubId}`}, 0))`;
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (existing) {
        await this.assertReplay(transaction, existing, actorUserId, clubId, "MEMBERSHIP_LEFT", input.requestHash);
        return { changed: existing.changed, replayed: true };
      }
      const actor = await transaction.user.findUnique({
        where: { id: actorUserId },
        select: {
          status: true,
          memberships: {
            where: { clubId, status: "ACTIVE", club: { deletedAt: null } },
            take: 1,
            select: { id: true, role: true },
          },
        },
      });
      const membership = actor?.memberships[0];
      if (actor?.status !== "ACTIVE" || !membership) {
        throw new ClubAuthorizationError("The current User cannot leave this Club.");
      }
      if (membership.role === "ADMIN") {
        throw new ClubConflictError("A Club Admin must transfer administration or delete the Club before leaving.");
      }
      await transaction.membership.update({
        where: { id: membership.id },
        data: { status: "LEFT", leftAt: new Date() },
      });
      await transaction.clubAuditEvent.create({
        data: {
          operationId,
          requestHash: input.requestHash,
          clubId,
          actorUserId,
          subjectUserId: actorUserId,
          subjectMembershipId: membership.id,
          action: "MEMBERSHIP_LEFT",
          changed: true,
          previousRole: membership.role,
        },
      });
      return { changed: true, replayed: false };
    });
  }

  async delete(input: DeleteClubInput): Promise<ClubAvatarReferenceResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${clubId}`}, 0))`;
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (existing) {
        await this.assertReplay(transaction, existing, actorUserId, clubId, "CLUB_DELETED", input.requestHash);
        return { changed: existing.changed, replayed: true };
      }
      const actor = await this.activeAdmin(transaction, actorUserId, clubId, false);
      if (input.confirmation !== actor.club.name) {
        throw new ClubConflictError("The Club name confirmation does not match.");
      }
      if (await transaction.session.count({ where: { clubId } })) {
        throw new ClubConflictError("A Club with Session history cannot be deleted.");
      }
      const deletedAt = new Date();
      await transaction.club.update({
        where: { id: clubId },
        data: { avatarObjectKey: null, deletedAt, lifecycle: "ARCHIVED" },
      });
      await transaction.membership.updateMany({
        where: { clubId, status: "ACTIVE" },
        data: { status: "REMOVED", leftAt: deletedAt },
      });
      await transaction.clubAuditEvent.create({
        data: {
          operationId,
          requestHash: input.requestHash,
          clubId,
          actorUserId,
          subjectUserId: actorUserId,
          subjectMembershipId: actor.membershipId,
          action: "CLUB_DELETED",
          changed: true,
        },
      });
      return {
        changed: true,
        replayed: false,
        ...(actor.club.avatarObjectKey ? { previousObjectKey: actor.club.avatarObjectKey } : {}),
      };
    });
  }

  async updateAvatarReference(input: UpdateAvatarReferenceInput): Promise<ClubAvatarReferenceResult> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club-operation:${operationId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`club:${clubId}`}, 0))`;
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (existing) {
        await this.assertReplay(transaction, existing, actorUserId, clubId, "CLUB_AVATAR_UPDATED", input.requestHash);
        const current = await transaction.club.findUnique({
          where: { id: clubId },
          select: { avatarObjectKey: true },
        });
        return {
          changed: existing.changed,
          replayed: true,
          ...(current?.avatarObjectKey ? { currentObjectKey: current.avatarObjectKey } : {}),
        };
      }
      const actor = await this.activeAdmin(transaction, actorUserId, clubId, true);
      const previousObjectKey = actor.club.avatarObjectKey ?? undefined;
      const changed = previousObjectKey !== (input.objectKey ?? undefined);
      if (changed) {
        await transaction.club.update({
          where: { id: clubId },
          data: { avatarObjectKey: input.objectKey },
        });
      }
      await transaction.clubAuditEvent.create({
        data: {
          operationId,
          requestHash: input.requestHash,
          clubId,
          actorUserId,
          subjectUserId: actorUserId,
          subjectMembershipId: actor.membershipId,
          action: "CLUB_AVATAR_UPDATED",
          changed,
        },
      });
      return {
        changed,
        replayed: false,
        ...(input.objectKey ? { currentObjectKey: input.objectKey } : {}),
        ...(previousObjectKey ? { previousObjectKey } : {}),
      };
    });
  }

  async findAvatarReplay(input: FindAvatarReplayInput): Promise<ClubAvatarReferenceResult | null> {
    const actorUserId = canonicalUuid(input.actorUserId);
    const clubId = canonicalUuid(input.clubId);
    const operationId = canonicalUuid(input.operationId);
    return this.database.client.$transaction(async (transaction) => {
      const existing = await transaction.clubAuditEvent.findUnique({ where: { operationId } });
      if (!existing) {
        return null;
      }
      await this.assertReplay(
        transaction,
        existing,
        actorUserId,
        clubId,
        "CLUB_AVATAR_UPDATED",
        input.requestHash,
      );
      const current = await transaction.club.findUnique({
        where: { id: clubId },
        select: { avatarObjectKey: true },
      });
      return {
        changed: existing.changed,
        replayed: true,
        ...(current?.avatarObjectKey ? { currentObjectKey: current.avatarObjectKey } : {}),
      };
    });
  }

  private async assertReplay(
    transaction: Prisma.TransactionClient,
    existing: { action: string; actorUserId: string; clubId: string; requestHash: string | null },
    actorUserId: string,
    clubId: string,
    action: string,
    requestHash: string,
  ): Promise<void> {
    const actor = await transaction.user.findUnique({ where: { id: actorUserId }, select: { status: true } });
    if (actor?.status !== "ACTIVE") {
      throw new ClubAuthorizationError("The current User cannot replay this Club operation.");
    }
    if (
      existing.action !== action ||
      existing.actorUserId !== actorUserId ||
      existing.clubId !== clubId ||
      existing.requestHash !== requestHash
    ) {
      throw new ClubConflictError("The operation identifier was already used for another Club operation.");
    }
  }

  private async activeAdmin(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    clubId: string,
    requireActiveClub: boolean,
  ) {
    const actor = await transaction.user.findUnique({
      where: { id: actorUserId },
      select: {
        status: true,
        memberships: {
          where: { clubId, status: "ACTIVE" },
          take: 1,
          select: {
            id: true,
            role: true,
            club: {
              select: {
                name: true,
                lifecycle: true,
                deletedAt: true,
                avatarObjectKey: true,
                description: true,
                selectionScaleMin: true,
                selectionScaleMax: true,
                showNominationAuthors: true,
                showNominationsBeforeSubmit: true,
                showVoteResults: true,
                showRatingResults: true,
                useMonochromeMedia: true,
              },
            },
          },
        },
      },
    });
    const membership = actor?.memberships[0];
    if (actor?.status !== "ACTIVE" || membership?.role !== "ADMIN" || membership.club.deletedAt) {
      throw new ClubAuthorizationError("The current User cannot manage this Club.");
    }
    if (requireActiveClub && membership.club.lifecycle !== "ACTIVE") {
      throw new ClubConflictError("Archived Clubs are read-only until reactivated.");
    }
    return { membershipId: membership.id, club: membership.club };
  }
}
