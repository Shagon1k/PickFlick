"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  CLUB_AVATAR_MAX_BYTES,
  CLUB_AVATAR_MEDIA_TYPES,
  type UpdateClubSettingsRequest,
} from "@pickflick/contracts";

import {
  removeClubAvatar,
  submitClubMemberRole,
  submitClubOperation,
  submitClubSettings,
  uploadClubAvatar,
  type ClubApiResult,
} from "../../../../components/clubs/club-api";
import { clubFailureMessage } from "../../../../components/clubs/club-errors";
import { clubValues, validateClubValues } from "../../../../components/clubs/club-form.validation";
import type { ClubManagementActionState } from "../../../../components/clubs/club-management.types";

function state(
  previous: ClubManagementActionState,
  status: "error" | "success",
  message: string,
): ClubManagementActionState {
  return { status, message, revision: previous.revision + 1 };
}

function operationId(formData: FormData): string {
  return String(formData.get("operationId") ?? "");
}

function apiFailure(
  previous: ClubManagementActionState,
  status: number,
  reason?: string,
): ClubManagementActionState {
  return state(previous, "error", clubFailureMessage(status, reason));
}

async function submitMutation<T>(
  previous: ClubManagementActionState,
  request: () => Promise<ClubApiResult<T>>,
): Promise<{ readonly failure: ClubManagementActionState } | { readonly response: ClubApiResult<T> }> {
  try {
    const response = await request();
    return response.ok ? { response } : { failure: apiFailure(previous, response.status, response.reason) };
  } catch {
    return { failure: apiFailure(previous, 503) };
  }
}

export async function updateClubSettingsAction(
  clubId: string,
  previous: ClubManagementActionState,
  formData: FormData,
): Promise<ClubManagementActionState> {
  const values = clubValues(formData);
  if (Object.keys(validateClubValues(values)).length > 0) {
    return state(previous, "error", "Review the Club name, description, and Selection scale.");
  }
  const payload: UpdateClubSettingsRequest = {
    operationId: operationId(formData),
    name: values.name,
    ...(values.description.trim() ? { description: values.description } : {}),
    selectionScaleMin: Number(values.selectionScaleMin) as 0 | 1,
    selectionScaleMax: Number(values.selectionScaleMax),
    showNominationAuthors: formData.get("showNominationAuthors") === "on",
    showNominationsBeforeSubmit: formData.get("showNominationsBeforeSubmit") === "on",
    showVoteResults: formData.get("showVoteResults") === "on",
    showRatingResults: formData.get("showRatingResults") === "on",
    useMonochromeMedia: formData.get("useMonochromeMedia") === "on",
  };
  const result = await submitMutation(previous, async () => submitClubSettings(await headers(), clubId, payload));
  if ("failure" in result) {
    return result.failure;
  }
  const { response } = result;
  revalidatePath(`/clubs/${clubId}/settings`);
  revalidatePath("/app");
  return state(previous, "success", response.body?.changed ? "Club settings saved." : "Club settings were already current.");
}

export async function changeClubMemberRoleAction(
  clubId: string,
  membershipId: string,
  previous: ClubManagementActionState,
  formData: FormData,
): Promise<ClubManagementActionState> {
  const nextRole = formData.get("nextRole");
  if (nextRole !== "MODERATOR" && nextRole !== "MEMBER") {
    return state(previous, "error", "Choose Moderator or Member.");
  }
  const result = await submitMutation(previous, async () => submitClubMemberRole(await headers(), clubId, membershipId, {
    operationId: operationId(formData),
    nextRole,
  }));
  if ("failure" in result) {
    return result.failure;
  }
  const { response } = result;
  revalidatePath(`/clubs/${clubId}/settings`);
  return state(previous, "success", response.body?.changed ? "Member role updated." : "That member already has this role.");
}

export async function clubLifecycleAction(
  clubId: string,
  action: "archive" | "delete" | "leave" | "reactivate",
  previous: ClubManagementActionState,
  formData: FormData,
): Promise<ClubManagementActionState> {
  const confirmation = String(formData.get("confirmation") ?? "");
  const request = action === "reactivate"
    ? { action, operationId: operationId(formData) } as const
    : { action, confirmation, operationId: operationId(formData) } as const;
  const result = await submitMutation(previous, async () => submitClubOperation(await headers(), clubId, request));
  if ("failure" in result) {
    return result.failure;
  }
  revalidatePath("/app");
  if (action === "delete" || action === "leave") {
    redirect("/app");
  }
  revalidatePath(`/clubs/${clubId}/settings`);
  return state(previous, "success", action === "archive" ? "Club archived." : "Club reactivated.");
}

export async function uploadClubAvatarAction(
  clubId: string,
  previous: ClubManagementActionState,
  formData: FormData,
): Promise<ClubManagementActionState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0 || file.size > CLUB_AVATAR_MAX_BYTES ||
    !(CLUB_AVATAR_MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return state(previous, "error", "Choose a PNG, JPEG, or WebP image no larger than 512 KiB.");
  }
  const result = await submitMutation(previous, async () =>
    uploadClubAvatar(await headers(), clubId, operationId(formData), file));
  if ("failure" in result) {
    return result.failure;
  }
  revalidatePath(`/clubs/${clubId}/settings`);
  return state(previous, "success", "Club avatar updated.");
}

export async function removeClubAvatarAction(
  clubId: string,
  previous: ClubManagementActionState,
  formData: FormData,
): Promise<ClubManagementActionState> {
  const result = await submitMutation(previous, async () =>
    removeClubAvatar(await headers(), clubId, { operationId: operationId(formData) }));
  if ("failure" in result) {
    return result.failure;
  }
  const { response } = result;
  revalidatePath(`/clubs/${clubId}/settings`);
  return state(previous, "success", response.body?.changed ? "Club avatar removed." : "The Club has no avatar to remove.");
}
