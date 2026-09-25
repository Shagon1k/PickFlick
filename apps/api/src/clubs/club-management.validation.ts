import { createHash } from "node:crypto";

import type { ClubVisibilitySettings } from "@pickflick/contracts";

import { canonicalUuid, isUuid } from "../common/validation/uuid.js";
import { ClubValidationError } from "./club.errors.js";
import type {
  NormalizedClubOperation,
  NormalizedClubSettings,
} from "./club-management.types.js";
import { parseCreateClubInput } from "./club-onboarding.validation.js";

const visibilityFields = [
  "showNominationAuthors",
  "showNominationsBeforeSubmit",
  "showVoteResults",
  "showRatingResults",
  "useMonochromeMedia",
] as const satisfies readonly (keyof ClubVisibilitySettings)[];

function objectInput(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ClubValidationError(message);
  }
  return value as Record<string, unknown>;
}

export function parseOperationId(value: unknown): string {
  if (!isUuid(value)) {
    throw new ClubValidationError("operationId must be a UUID.");
  }
  return canonicalUuid(value);
}

export function parseClubOperation(value: unknown, confirmationRequired = false): NormalizedClubOperation {
  const input = objectInput(value, "Club operation input must be an object.");
  const allowedFields = confirmationRequired ? ["operationId", "confirmation"] : ["operationId"];
  if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
    throw new ClubValidationError("Club operation input contains an unsupported field.");
  }
  const operationId = parseOperationId(input.operationId);
  if (confirmationRequired && (typeof input.confirmation !== "string" || !input.confirmation.trim())) {
    throw new ClubValidationError("A confirmation value is required.");
  }
  return {
    operationId,
    ...(typeof input.confirmation === "string" ? { confirmation: input.confirmation } : {}),
  };
}

export function parseClubSettings(value: unknown): { operationId: string; settings: NormalizedClubSettings } {
  const input = objectInput(value, "Club settings input must be an object.");
  const allowedFields = [
    "operationId",
    "name",
    "description",
    "selectionScaleMin",
    "selectionScaleMax",
    ...visibilityFields,
  ];
  if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
    throw new ClubValidationError("Club settings input contains an unsupported field.");
  }
  const club = parseCreateClubInput({
    name: input.name,
    description: input.description,
    selectionScaleMin: input.selectionScaleMin,
    selectionScaleMax: input.selectionScaleMax,
  });
  const visibility = {} as Record<keyof ClubVisibilitySettings, boolean>;
  for (const field of visibilityFields) {
    if (typeof input[field] !== "boolean") {
      throw new ClubValidationError(`${field} must be a boolean.`);
    }
    visibility[field] = input[field];
  }
  return {
    operationId: parseOperationId(input.operationId),
    settings: { ...club, ...visibility },
  };
}

export function operationRequestHash(action: string, value: unknown): string {
  return createHash("sha256").update(JSON.stringify({ action, value })).digest("hex");
}

export function parseMemberRoleChange(value: unknown): {
  operationId: string;
  nextRole: "MODERATOR" | "MEMBER";
} {
  const input = objectInput(value, "Membership role input must be an object.");
  if (Object.keys(input).some((key) => !["operationId", "nextRole"].includes(key))) {
    throw new ClubValidationError("Membership role input contains an unsupported field.");
  }
  if (input.nextRole !== "MODERATOR" && input.nextRole !== "MEMBER") {
    throw new ClubValidationError("nextRole must be MODERATOR or MEMBER.");
  }
  return { operationId: parseOperationId(input.operationId), nextRole: input.nextRole };
}
