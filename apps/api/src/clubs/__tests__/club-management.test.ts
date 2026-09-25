import { randomUUID } from "node:crypto";

import { ForbiddenException } from "@nestjs/common";
import type { ApplicationLogger } from "@pickflick/observability";
import { describe, expect, it, vi } from "vitest";

import { ClubAvatarStorage } from "../club-avatar.storage.js";
import {
  ClubManagementRepository,
  type ClubAvatarReferenceResult,
  type ClubManagementResult,
} from "../club-management.repository.js";
import { ClubManagementService } from "../club-management.service.js";
import { ClubConflictError } from "../club.errors.js";
import type {
  ClubLifecycleInput,
  DeleteClubInput,
  FindAvatarReplayInput,
  LeaveClubInput,
  PersistClubSettingsInput,
  StoredClubAvatarAccess,
  StoredClubManagementView,
  UpdateAvatarReferenceInput,
} from "../club-management.types.js";
import { operationRequestHash } from "../club-operation-replay.js";
import { StaticClubTierResolver } from "../club-tiers.js";
import type { ClubRoleTransitionService } from "../club-role-transition.service.js";

const ids = {
  club: "10000000-0000-4000-8000-000000000002",
  admin: "00000000-0000-4000-8000-000000000001",
  member: "00000000-0000-4000-8000-000000000002",
  membership: "20000000-0000-4000-8000-000000000001",
};

function stored(role: "ADMIN" | "MODERATOR" | "MEMBER"): StoredClubManagementView {
  return {
    subject: { appRole: "USER", clubRole: role, lifecycle: "ACTIVE", userStatus: "ACTIVE" },
    club: {
      id: ids.club,
      name: "Midnight Society",
      hasAvatar: false,
      lifecycle: "ACTIVE",
      membershipRole: role,
      selectionScaleMin: 0,
      selectionScaleMax: 7,
    },
    visibility: {
      showNominationAuthors: true,
      showNominationsBeforeSubmit: true,
      showVoteResults: false,
      showRatingResults: true,
      useMonochromeMedia: true,
    },
    members: [{ id: ids.membership, displayName: "Avery", role, joinedAt: new Date(0).toISOString() }],
    auditEvents: role === "ADMIN" ? [{
      id: randomUUID(),
      action: "CLUB_SETTINGS_UPDATED",
      changed: true,
      createdAt: new Date(0).toISOString(),
    }] : [],
  };
}

class ManagementRepository extends ClubManagementRepository {
  readonly updateSettingsCall = vi.fn(async (input: PersistClubSettingsInput): Promise<ClubManagementResult> => {
    void input;
    return { changed: true, replayed: false };
  });
  readonly lifecycleCall = vi.fn(async (input: ClubLifecycleInput): Promise<ClubManagementResult> => {
    void input;
    return { changed: true, replayed: false };
  });
  readonly leaveCall = vi.fn(async (input: LeaveClubInput): Promise<ClubManagementResult> => {
    void input;
    return { changed: true, replayed: false };
  });
  readonly deleteCall = vi.fn(async (input: DeleteClubInput): Promise<ClubAvatarReferenceResult> => {
    void input;
    return { changed: true, replayed: false };
  });
  readonly avatarCall = vi.fn(async (input: UpdateAvatarReferenceInput): Promise<ClubAvatarReferenceResult> => {
    void input;
    return { changed: true, replayed: false };
  });
  readonly avatarReplayCall = vi.fn(async (input: FindAvatarReplayInput): Promise<ClubAvatarReferenceResult | null> => {
    void input;
    return null;
  });

  async readForUser(userId: string): Promise<StoredClubManagementView | null> {
    if (userId === ids.admin) {
      return stored("ADMIN");
    }
    if (userId === ids.member) {
      return stored("MEMBER");
    }
    return null;
  }
  async readAvatarAccess(userId: string): Promise<StoredClubAvatarAccess | null> {
    const view = await this.readForUser(userId);
    return view ? { subject: view.subject } : null;
  }
  async updateSettings(input: PersistClubSettingsInput) { return this.updateSettingsCall(input); }
  async changeLifecycle(input: ClubLifecycleInput) { return this.lifecycleCall(input); }
  async leave(input: LeaveClubInput) { return this.leaveCall(input); }
  async delete(input: DeleteClubInput) { return this.deleteCall(input); }
  async findAvatarReplay(input: FindAvatarReplayInput) { return this.avatarReplayCall(input); }
  async updateAvatarReference(input: UpdateAvatarReferenceInput) { return this.avatarCall(input); }
}

class AvatarStorage extends ClubAvatarStorage {
  readonly putCall = vi.fn(async (objectKey: string, body: Buffer, contentType: string) => {
    void objectKey;
    void body;
    void contentType;
  });
  readonly deleteCall = vi.fn(async (objectKey: string) => {
    void objectKey;
  });
  async put(objectKey: string, body: Buffer, contentType: string) { return this.putCall(objectKey, body, contentType); }
  async get() { return undefined; }
  async delete(objectKey: string) { return this.deleteCall(objectKey); }
}

function principal(userId: string) {
  return { appRole: "USER" as const, sessionId: randomUUID(), userId };
}

function service() {
  const repository = new ManagementRepository();
  const avatars = new AvatarStorage();
  const errorLog = vi.fn();
  const logger = { error: errorLog, info: vi.fn() } as unknown as ApplicationLogger;
  const roles = {
    changeMembershipRole: vi.fn(async () => ({ changed: true, replayed: false })),
  } as unknown as ClubRoleTransitionService;
  return {
    avatars,
    repository,
    service: new ClubManagementService(
      repository,
      roles,
      new StaticClubTierResolver(),
      avatars,
      logger,
    ),
    errorLog,
  };
}

const validSettings = {
  operationId: "40000000-0000-4000-8000-000000000001",
  name: "Midnight Society",
  selectionScaleMin: 0,
  selectionScaleMax: 7,
  showNominationAuthors: true,
  showNominationsBeforeSubmit: true,
  showVoteResults: false,
  showRatingResults: true,
  useMonochromeMedia: true,
};

describe("Club management service", () => {
  it("projects role-specific actions and withholds a non-member Club", async () => {
    const fixture = service();
    await expect(fixture.service.project(principal(ids.admin), ids.club)).resolves.toMatchObject({
      permissions: { manageSettings: true, manageRoles: true, leaveClub: false },
      auditEvents: [{ action: "CLUB_SETTINGS_UPDATED" }],
    });
    await expect(fixture.service.project(principal(ids.member), ids.club)).resolves.toMatchObject({
      permissions: { manageSettings: false, manageRoles: false, leaveClub: true },
      auditEvents: [],
    });
    await expect(fixture.service.project(principal(randomUUID()), ids.club)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("passes the current tier rule to serialized settings persistence", async () => {
    const fixture = service();
    fixture.repository.updateSettingsCall.mockRejectedValueOnce(
      new ClubConflictError("TIER_SETTING_UNAVAILABLE", "Vote-result visibility is not configurable on this Club tier."),
    );
    await expect(fixture.service.updateSettings(principal(ids.admin), ids.club, {
      ...validSettings,
      showVoteResults: true,
    })).rejects.toThrow(/not configurable/u);
    expect(fixture.repository.updateSettingsCall).toHaveBeenCalledWith(expect.objectContaining({
      showVoteResults: true,
      voteResultVisibility: "ADMIN_HIDDEN",
    }));
  });

  it("requires exact lifecycle confirmations and passes an idempotency hash", async () => {
    const fixture = service();
    await expect(fixture.service.changeLifecycle(principal(ids.admin), ids.club, "archive", {
      operationId: randomUUID(),
      confirmation: "archive",
    })).rejects.toThrow(/confirmation/u);
    await expect(fixture.service.changeLifecycle(principal(ids.admin), ids.club, "archive", {
      operationId: randomUUID(),
      confirmation: " ARCHIVE ",
    })).rejects.toThrow(/confirmation/u);
    const operationId = randomUUID();
    await expect(fixture.service.changeLifecycle(principal(ids.admin), ids.club, "archive", {
      operationId,
      confirmation: "ARCHIVE",
    })).resolves.toEqual({ changed: true, replayed: false });
    expect(fixture.repository.lifecycleCall).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: ids.admin,
      operationId,
      requestHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    }));
  });

  it("preserves deletion confirmation text for exact comparison and hashing", async () => {
    const fixture = service();
    const operationId = randomUUID();
    const confirmation = " Midnight Society ";

    await fixture.service.delete(principal(ids.admin), ids.club, { operationId, confirmation });

    expect(fixture.repository.deleteCall).toHaveBeenCalledWith({
      actorUserId: ids.admin,
      clubId: ids.club,
      confirmation,
      operationId,
      requestHash: operationRequestHash("delete", { confirmation }),
    });
  });

  it("passes the current tier Admin Club limit to reactivation persistence", async () => {
    const fixture = service();
    await fixture.service.changeLifecycle(principal(ids.admin), ids.club, "reactivate", {
      operationId: randomUUID(),
    });

    expect(fixture.repository.lifecycleCall).toHaveBeenCalledWith(expect.objectContaining({
      action: "reactivate",
      adminClubLimit: 1,
    }));
  });

  it("validates avatar bytes before writing private object storage", async () => {
    const fixture = service();
    await expect(fixture.service.putAvatar(
      principal(ids.admin),
      ids.club,
      randomUUID(),
      Buffer.from("not an image"),
      "image/png",
    )).rejects.toThrow(/must match/u);
    expect(fixture.avatars.putCall).not.toHaveBeenCalled();

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    await expect(fixture.service.putAvatar(
      principal(ids.admin),
      ids.club,
      randomUUID(),
      png,
      "image/png",
    )).resolves.toMatchObject({ changed: true, hasAvatar: true, replayed: false });
    expect(fixture.avatars.putCall).toHaveBeenCalledOnce();
    expect(fixture.repository.avatarCall).toHaveBeenCalledOnce();
  });

  it("does not resurrect an avatar when an old upload operation is replayed", async () => {
    const fixture = service();
    fixture.repository.avatarCall.mockResolvedValueOnce({ changed: true, replayed: true });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

    await expect(fixture.service.putAvatar(
      principal(ids.admin),
      ids.club,
      randomUUID(),
      png,
      "image/png",
    )).resolves.toMatchObject({ changed: true, hasAvatar: false, replayed: true });

    expect(fixture.avatars.putCall).toHaveBeenCalledOnce();
    expect(fixture.avatars.deleteCall).toHaveBeenCalledOnce();
  });

  it("returns an avatar replay before current authorization or storage", async () => {
    const fixture = service();
    fixture.repository.avatarReplayCall.mockResolvedValueOnce({ changed: true, replayed: true });
    const authorization = vi.spyOn(fixture.repository, "readAvatarAccess");
    const operationId = randomUUID();
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

    await expect(fixture.service.putAvatar(
      principal(ids.admin),
      ids.club,
      operationId,
      png,
      "image/png",
    )).resolves.toEqual({ changed: true, hasAvatar: false, replayed: true });

    expect(fixture.repository.avatarReplayCall).toHaveBeenCalledWith({
      actorUserId: ids.admin,
      clubId: ids.club,
      operationId,
      requestHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    expect(authorization).not.toHaveBeenCalled();
    expect(fixture.avatars.putCall).not.toHaveBeenCalled();
    expect(fixture.repository.avatarCall).not.toHaveBeenCalled();
  });

  it("deletes the uploaded object when the reference update is rejected", async () => {
    const fixture = service();
    const rejection = new ClubConflictError("CLUB_ARCHIVED", "Archived Clubs are read-only until reactivated.");
    fixture.repository.avatarCall.mockRejectedValueOnce(rejection);
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

    await expect(fixture.service.putAvatar(
      principal(ids.admin),
      ids.club,
      randomUUID(),
      png,
      "image/png",
    )).rejects.toBe(rejection);

    const uploadedKey = fixture.avatars.putCall.mock.calls[0]?.[0];
    expect(uploadedKey).toMatch(/^club-avatars\//u);
    expect(fixture.avatars.deleteCall).toHaveBeenCalledExactlyOnceWith(uploadedKey);
  });

  it("retains a stored avatar when the persistence commit outcome is unknown", async () => {
    const fixture = service();
    const persistenceFailure = new Error("database unavailable");
    fixture.repository.avatarCall.mockRejectedValueOnce(persistenceFailure);
    const operationId = randomUUID();
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

    await expect(fixture.service.putAvatar(
      principal(ids.admin),
      ids.club,
      operationId,
      png,
      "image/png",
    )).rejects.toBe(persistenceFailure);

    expect(fixture.avatars.putCall).toHaveBeenCalledOnce();
    expect(fixture.avatars.deleteCall).not.toHaveBeenCalled();
    expect(fixture.errorLog).not.toHaveBeenCalled();
  });
});
