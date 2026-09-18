import type {
  ClubAuditProjection,
  ClubMemberProjection,
  ClubSummary,
  ClubVisibilitySettings,
  UpdateClubSettingsRequest,
} from "@pickflick/contracts";

import type { ClubPolicySubject } from "./club-policy.js";

export interface NormalizedClubOperation {
  readonly confirmation?: string;
  readonly operationId: string;
}

export interface NormalizedClubSettings extends Omit<UpdateClubSettingsRequest, "operationId" | "confirmation"> {
  readonly description?: string;
}

export interface PersistClubSettingsInput extends NormalizedClubSettings {
  readonly actorUserId: string;
  readonly clubId: string;
  readonly operationId: string;
  readonly requestHash: string;
}

interface ClubLifecycleInputBase {
  readonly actorUserId: string;
  readonly clubId: string;
  readonly operationId: string;
  readonly requestHash: string;
}

export type ClubLifecycleInput = ClubLifecycleInputBase & ({
  readonly action: "archive";
} | {
  readonly action: "reactivate";
  readonly adminClubLimit: number;
});

export interface LeaveClubInput {
  readonly actorUserId: string;
  readonly clubId: string;
  readonly operationId: string;
  readonly requestHash: string;
}

export interface DeleteClubInput extends LeaveClubInput {
  readonly confirmation: string;
}

export interface UpdateAvatarReferenceInput extends LeaveClubInput {
  readonly objectKey: string | null;
}

export interface StoredClubManagementView {
  readonly subject: ClubPolicySubject;
  readonly club: Omit<ClubSummary, "tier">;
  readonly visibility: ClubVisibilitySettings;
  readonly members: readonly ClubMemberProjection[];
  readonly auditEvents: readonly ClubAuditProjection[];
  readonly avatarObjectKey?: string;
}

export type StoredVisibilitySettings = ClubVisibilitySettings;
