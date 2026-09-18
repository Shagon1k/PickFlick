import {
  CLUB_DESCRIPTION_MAX_LENGTH,
  CLUB_NAME_MAX_LENGTH,
  CLUB_NAME_MIN_LENGTH,
} from "@pickflick/contracts";

import type { ClubFieldErrors, ClubFormValues } from "./club-form.types";

function containsUnsafeControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (codePoint < 32 && codePoint !== 9 && codePoint !== 10) || codePoint === 127;
  });
}

export function clubValues(formData: FormData): ClubFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    selectionScaleMin: String(formData.get("selectionScaleMin") ?? ""),
    selectionScaleMax: String(formData.get("selectionScaleMax") ?? ""),
  };
}

export function validateClubValues(values: ClubFormValues): ClubFieldErrors {
  const errors: ClubFieldErrors = {};
  const name = values.name.trim();
  if (name.length < CLUB_NAME_MIN_LENGTH) {
    errors.name = `Use at least ${CLUB_NAME_MIN_LENGTH} characters.`;
  } else if (name.length > CLUB_NAME_MAX_LENGTH || /[\r\n]/u.test(name) || containsUnsafeControlCharacter(name)) {
    errors.name = `Keep the Club name to ${CLUB_NAME_MAX_LENGTH} safe, single-line characters.`;
  }

  const description = values.description.trim();
  if (
    description.length > CLUB_DESCRIPTION_MAX_LENGTH || containsUnsafeControlCharacter(description)
  ) {
    errors.description = `Keep the description to ${CLUB_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  const selectionScaleMin = Number(values.selectionScaleMin);
  const selectionScaleMax = Number(values.selectionScaleMax);
  if (selectionScaleMin !== 0 && selectionScaleMin !== 1) {
    errors.selectionScaleMin = "Choose 0 or 1 as the first score.";
  }
  if (!Number.isInteger(selectionScaleMax) || selectionScaleMax < 1 || selectionScaleMax > 10) {
    errors.selectionScaleMax = "Choose a final score from 1 through 10.";
  } else if ((selectionScaleMin === 0 || selectionScaleMin === 1) && selectionScaleMax <= selectionScaleMin) {
    errors.selectionScaleMax = "The final score must be greater than the first score.";
  }
  return errors;
}
