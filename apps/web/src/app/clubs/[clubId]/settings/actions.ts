"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { UpdateClubSettingsRequest } from "@pickflick/contracts";

import {
  removeClubAvatar,
  submitClubMemberRole,
  submitClubOperation,
  submitClubSettings,
  uploadClubAvatar,
} from "../../../../components/clubs/club-api";
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

function apiFailure(previous: ClubManagementActionState, status: number): ClubManagementActionState {
  if (status === 401) {
    return state(previous, "error", "Your session expired. Sign in again, then retry.");
  }
  if (status === 403) {
    return state(previous, "error", "Your current Club role does not allow that action.");
  }
  if (status === 409) {
    return state(previous, "error", "The Club changed or the confirmation did not match. Reload and try again.");
  }
  return state(previous, "error", "The Club could not be updated. Nothing unsafe was applied; try again.");
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
  const response = await submitClubSettings(await headers(), clubId, payload);
  if (!response.ok) {
    return apiFailure(previous, response.status);
  }
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
  const response = await submitClubMemberRole(await headers(), clubId, membershipId, {
    operationId: operationId(formData),
    nextRole,
  });
  if (!response.ok) {
    return apiFailure(previous, response.status);
  }
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
  const response = await submitClubOperation(await headers(), clubId, action, {
    operationId: operationId(formData),
    ...(confirmation ? { confirmation } : {}),
  });
  if (!response.ok) {
    return apiFailure(previous, response.status);
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
  if (!(file instanceof File) || file.size === 0 || file.size > 512 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return state(previous, "error", "Choose a PNG, JPEG, or WebP image no larger than 512 KiB.");
  }
  const response = await uploadClubAvatar(await headers(), clubId, operationId(formData), file);
  if (!response.ok) {
    return apiFailure(previous, response.status);
  }
  revalidatePath(`/clubs/${clubId}/settings`);
  return state(previous, "success", "Club avatar updated.");
}

export async function removeClubAvatarAction(
  clubId: string,
  previous: ClubManagementActionState,
  formData: FormData,
): Promise<ClubManagementActionState> {
  const response = await removeClubAvatar(await headers(), clubId, { operationId: operationId(formData) });
  if (!response.ok) {
    return apiFailure(previous, response.status);
  }
  revalidatePath(`/clubs/${clubId}/settings`);
  return state(previous, "success", response.body?.changed ? "Club avatar removed." : "The Club has no avatar to remove.");
}
