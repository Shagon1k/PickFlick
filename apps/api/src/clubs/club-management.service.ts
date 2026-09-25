import { createHash } from "node:crypto";

import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CLUB_AVATAR_MAX_BYTES,
  type ClubAvatarMediaType,
  type ClubAvatarResponse,
  ClubOperationReceipt,
  ClubSettingsProjection,
  UpdateClubSettingsResponse,
} from "@pickflick/contracts";
import type { ApplicationLogger } from "@pickflick/observability";

import type { AuthenticatedPrincipal } from "../identity/authorization.types.js";
import { APPLICATION_LOGGER } from "../runtime.tokens.js";
import { ClubAvatarStorage } from "./club-avatar.storage.js";
import { ClubAuthorizationError, ClubConflictError, ClubValidationError } from "./club.errors.js";
import {
  ClubManagementRepository,
  type ClubAvatarReferenceResult,
  type ClubManagementResult,
} from "./club-management.repository.js";
import {
  operationRequestHash,
  parseClubOperation,
  parseClubSettings,
  parseMemberRoleChange,
  parseOperationId,
} from "./club-management.validation.js";
import { projectClubPermissions } from "./club-policy.js";
import { ClubTierResolver } from "./club-tiers.js";
import { ClubRoleTransitionService } from "./clubs.service.js";

interface ClubAvatarPayload {
  readonly body: Buffer;
  readonly contentType: ClubAvatarMediaType;
  readonly extension: "jpg" | "png" | "webp";
}

function avatarPayload(body: unknown, suppliedContentType: string | undefined): ClubAvatarPayload {
  if (!Buffer.isBuffer(body) || body.length === 0 || body.length > CLUB_AVATAR_MAX_BYTES) {
    throw new ClubValidationError("Club avatar must be a non-empty image no larger than 512 KiB.");
  }
  const contentType = suppliedContentType?.split(";", 1)[0]?.trim().toLowerCase();
  const png = body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  const webp = body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP";
  if (contentType === "image/png" && png) {
    return { body, contentType, extension: "png" };
  }
  if (contentType === "image/jpeg" && jpeg) {
    return { body, contentType, extension: "jpg" };
  }
  if (contentType === "image/webp" && webp) {
    return { body, contentType, extension: "webp" };
  }
  throw new ClubValidationError("Club avatar content must match a PNG, JPEG, or WebP media type.");
}

function isClubDomainRejection(error: unknown): boolean {
  return (
    error instanceof ClubAuthorizationError ||
    error instanceof ClubConflictError ||
    error instanceof ClubValidationError
  );
}

@Injectable()
export class ClubManagementService {
  constructor(
    private readonly repository: ClubManagementRepository,
    private readonly roles: ClubRoleTransitionService,
    private readonly tiers: ClubTierResolver,
    private readonly avatars: ClubAvatarStorage,
    @Inject(APPLICATION_LOGGER) private readonly logger: ApplicationLogger,
  ) {}

  async project(principal: AuthenticatedPrincipal, clubId: string): Promise<ClubSettingsProjection> {
    const stored = await this.repository.readForUser(principal.userId, clubId);
    if (!stored) {
      throw new ForbiddenException();
    }
    const entitlements = await this.tiers.resolve(clubId);
    return {
      club: { ...stored.club, tier: entitlements.tier },
      permissions: projectClubPermissions(stored.subject),
      entitlements,
      visibility: stored.visibility,
      members: stored.members,
      auditEvents: stored.auditEvents,
    };
  }

  async updateSettings(
    principal: AuthenticatedPrincipal,
    clubId: string,
    value: unknown,
  ): Promise<UpdateClubSettingsResponse> {
    const parsed = parseClubSettings(value);
    const tier = await this.tiers.resolve(clubId);
    const receipt = await this.repository.updateSettings({
      ...parsed.settings,
      actorUserId: principal.userId,
      clubId,
      operationId: parsed.operationId,
      requestHash: operationRequestHash("settings", parsed.settings),
      voteResultVisibility: tier.voteResultVisibility,
    });
    this.logChange(receipt, "club.settings.updated", "Club settings updated.");
    return { ...receipt, settings: await this.project(principal, clubId) };
  }

  async changeMemberRole(
    principal: AuthenticatedPrincipal,
    clubId: string,
    membershipId: string,
    value: unknown,
  ): Promise<ClubOperationReceipt> {
    const parsed = parseMemberRoleChange(value);
    const result = await this.roles.changeMembershipRole({
      actorUserId: principal.userId,
      clubId,
      operationId: parsed.operationId,
      targetMembershipId: membershipId,
      nextRole: parsed.nextRole,
    });
    return { changed: result.changed, replayed: result.replayed };
  }

  async changeLifecycle(
    principal: AuthenticatedPrincipal,
    clubId: string,
    action: "archive" | "reactivate",
    value: unknown,
  ): Promise<ClubOperationReceipt> {
    const parsed = parseClubOperation(value, action === "archive");
    if (action === "archive" && parsed.confirmation !== "ARCHIVE") {
      throw new ClubConflictError("CONFIRMATION_MISMATCH", "Archive confirmation does not match.");
    }
    const requestHash = operationRequestHash(action, { confirmation: parsed.confirmation });
    const input = {
      actorUserId: principal.userId,
      clubId,
      operationId: parsed.operationId,
      requestHash,
    };
    const receipt = action === "reactivate"
      ? await this.repository.changeLifecycle({
          ...input,
          action,
          adminClubLimit: (await this.tiers.resolve(clubId)).adminClubLimit,
        })
      : await this.repository.changeLifecycle({ ...input, action });
    this.logChange(receipt, `club.${action}d`, `Club ${action}d.`);
    return receipt;
  }

  async leave(principal: AuthenticatedPrincipal, clubId: string, value: unknown): Promise<ClubOperationReceipt> {
    const parsed = parseClubOperation(value, true);
    if (parsed.confirmation !== "LEAVE") {
      throw new ClubConflictError("CONFIRMATION_MISMATCH", "Leave confirmation does not match.");
    }
    const receipt = await this.repository.leave({
      actorUserId: principal.userId,
      clubId,
      operationId: parsed.operationId,
      requestHash: operationRequestHash("leave", { confirmation: parsed.confirmation }),
    });
    this.logChange(receipt, "club.membership.left", "Club Membership left.");
    return receipt;
  }

  async delete(principal: AuthenticatedPrincipal, clubId: string, value: unknown): Promise<ClubOperationReceipt> {
    const parsed = parseClubOperation(value, true);
    const confirmation = parsed.confirmation ?? "";
    const receipt = await this.repository.delete({
      actorUserId: principal.userId,
      clubId,
      confirmation,
      operationId: parsed.operationId,
      requestHash: operationRequestHash("delete", { confirmation }),
    });
    if (receipt.previousObjectKey) {
      await this.deleteRetiredAvatar(receipt.previousObjectKey);
    }
    this.logChange(receipt, "club.deleted", "Club deleted.");
    return { changed: receipt.changed, replayed: receipt.replayed };
  }

  async putAvatar(
    principal: AuthenticatedPrincipal,
    clubId: string,
    operationIdValue: unknown,
    body: unknown,
    contentType: string | undefined,
  ): Promise<ClubAvatarResponse> {
    const operationId = parseOperationId(operationIdValue);
    const avatar = avatarPayload(body, contentType);
    const contentHash = createHash("sha256").update(avatar.body).digest("hex");
    const requestHash = operationRequestHash("avatar", { contentHash, contentType: avatar.contentType });
    const replay = await this.repository.findAvatarReplay({
      actorUserId: principal.userId,
      clubId,
      operationId,
      requestHash,
    });
    if (replay) {
      return {
        changed: replay.changed,
        replayed: true,
        hasAvatar: Boolean(replay.currentObjectKey),
      };
    }
    await this.authorizeAvatarManagement(principal, clubId);
    const objectKey = `club-avatars/${clubId.toLowerCase()}/${operationId}-${contentHash}.${avatar.extension}`;
    await this.avatars.put(objectKey, avatar.body, avatar.contentType);
    let receipt: ClubAvatarReferenceResult;
    try {
      receipt = await this.repository.updateAvatarReference({
        actorUserId: principal.userId,
        clubId,
        objectKey,
        operationId,
        requestHash,
      });
    } catch (error) {
      // A domain rejection rolled the reference back, so the new object is unreferenced. Any other
      // failure leaves the commit outcome unknown, and the object must stay in case it committed.
      if (isClubDomainRejection(error)) {
        await this.deleteRetiredAvatar(objectKey);
      }
      throw error;
    }
    if (receipt.replayed && receipt.currentObjectKey !== objectKey) {
      await this.deleteRetiredAvatar(objectKey);
    }
    if (receipt.previousObjectKey && receipt.previousObjectKey !== objectKey) {
      await this.deleteRetiredAvatar(receipt.previousObjectKey);
    }
    this.logChange(receipt, "club.avatar.updated", "Club avatar updated.");
    return {
      changed: receipt.changed,
      replayed: receipt.replayed,
      hasAvatar: receipt.replayed ? Boolean(receipt.currentObjectKey) : true,
    };
  }

  async removeAvatar(
    principal: AuthenticatedPrincipal,
    clubId: string,
    value: unknown,
  ): Promise<ClubAvatarResponse> {
    const parsed = parseClubOperation(value);
    const receipt = await this.repository.updateAvatarReference({
      actorUserId: principal.userId,
      clubId,
      objectKey: null,
      operationId: parsed.operationId,
      requestHash: operationRequestHash("avatar-remove", null),
    });
    if (receipt.previousObjectKey) {
      await this.deleteRetiredAvatar(receipt.previousObjectKey);
    }
    this.logChange(receipt, "club.avatar.removed", "Club avatar removed.");
    return {
      changed: receipt.changed,
      replayed: receipt.replayed,
      hasAvatar: receipt.replayed ? Boolean(receipt.currentObjectKey) : false,
    };
  }

  async getAvatar(principal: AuthenticatedPrincipal, clubId: string) {
    const stored = await this.repository.readAvatarAccess(principal.userId, clubId);
    if (!stored || !projectClubPermissions(stored.subject).viewClub) {
      throw new ForbiddenException();
    }
    if (!stored.avatarObjectKey) {
      throw new NotFoundException();
    }
    const avatar = await this.avatars.get(stored.avatarObjectKey);
    if (!avatar) {
      throw new NotFoundException();
    }
    return avatar;
  }

  private async authorizeAvatarManagement(principal: AuthenticatedPrincipal, clubId: string): Promise<void> {
    const stored = await this.repository.readAvatarAccess(principal.userId, clubId);
    if (!stored || !projectClubPermissions(stored.subject).manageSettings) {
      throw new ForbiddenException();
    }
  }

  private logChange(receipt: ClubManagementResult, event: string, message: string): void {
    if (receipt.changed && !receipt.replayed) {
      this.logger.info({ event }, message);
    }
  }

  private async deleteRetiredAvatar(objectKey: string): Promise<void> {
    try {
      await this.avatars.delete(objectKey);
    } catch {
      this.logger.error(
        {
          event: "club.avatar.cleanup_failed",
          objectKeyDigest: createHash("sha256").update(objectKey).digest("hex"),
        },
        "Retired Club avatar cleanup failed.",
      );
    }
  }
}
