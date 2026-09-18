import { randomUUID } from "node:crypto";

import { ForbiddenException } from "@nestjs/common";
import { createLogger } from "@pickflick/observability";
import { describe, expect, it, vi } from "vitest";

import { ClubAvatarStorage } from "../club-avatar.storage.js";
import {
  ClubManagementRepository,
  type ClubAvatarReferenceResult,
  type ClubManagementResult,
} from "../club-management.repository.js";
import { ClubManagementService } from "../club-management.service.js";
import type {
  ClubLifecycleInput,
  DeleteClubInput,
  LeaveClubInput,
  PersistClubSettingsInput,
  StoredClubManagementView,
  UpdateAvatarReferenceInput,
} from "../club-management.types.js";
import { StaticClubTierResolver } from "../club-tiers.js";
import type { ClubRoleTransitionService } from "../clubs.service.js";

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
      subjectMembershipId: ids.membership,
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

  async readForUser(userId: string): Promise<StoredClubManagementView | null> {
    if (userId === ids.admin) {
      return stored("ADMIN");
    }
    if (userId === ids.member) {
      return stored("MEMBER");
    }
    return null;
  }
  async updateSettings(input: PersistClubSettingsInput) { return this.updateSettingsCall(input); }
  async changeLifecycle(input: ClubLifecycleInput) { return this.lifecycleCall(input); }
  async leave(input: LeaveClubInput) { return this.leaveCall(input); }
  async delete(input: DeleteClubInput) { return this.deleteCall(input); }
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
      createLogger({ environment: "test", service: "api" }),
    ),
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

  it("rejects a Free-only visibility escalation before persistence", async () => {
    const fixture = service();
    await expect(fixture.service.updateSettings(principal(ids.admin), ids.club, {
      ...validSettings,
      showVoteResults: true,
    })).rejects.toThrow(/not configurable/u);
    expect(fixture.repository.updateSettingsCall).not.toHaveBeenCalled();
  });

  it("requires exact lifecycle confirmations and passes an idempotency hash", async () => {
    const fixture = service();
    await expect(fixture.service.changeLifecycle(principal(ids.admin), ids.club, "archive", {
      operationId: randomUUID(),
      confirmation: "archive",
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
});
