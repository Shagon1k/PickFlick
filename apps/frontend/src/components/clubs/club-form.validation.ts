import {
    CLUB_DESCRIPTION_MAX_LENGTH,
    CLUB_NAME_MAX_LENGTH,
    CLUB_NAME_MIN_LENGTH,
    CLUB_SELECTION_SCALE_CEILING,
    createClubSchema,
} from '@pickflick/contracts';

import type {
    IClubFormValues,
    TClubFieldErrors,
    TClubFieldName,
} from '@/components/clubs/club-form.types';
import { fieldErrors } from '@/lib/form-errors';

const FIELD_MESSAGES: Record<TClubFieldName, string> = {
    name: `Use ${CLUB_NAME_MIN_LENGTH}–${CLUB_NAME_MAX_LENGTH} characters on a single line.`,
    description: `Keep the description to ${CLUB_DESCRIPTION_MAX_LENGTH} characters.`,
    selectionScaleMin: 'Choose 0 or 1 as the first score.',
    selectionScaleMax: `Choose a final score above the first score, up to ${CLUB_SELECTION_SCALE_CEILING}.`,
};

export function clubValues(formData: FormData): IClubFormValues {
    return {
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        selectionScaleMin: String(formData.get('selectionScaleMin') ?? ''),
        selectionScaleMax: String(formData.get('selectionScaleMax') ?? ''),
    };
}

/** Parses the form's string values into the create/update Club request fields. */
export function parseClubValues(values: IClubFormValues) {
    return createClubSchema.safeParse({
        ...values,
        selectionScaleMin: Number(values.selectionScaleMin),
        selectionScaleMax: Number(values.selectionScaleMax),
    });
}

export function validateClubValues(values: IClubFormValues): TClubFieldErrors {
    const parsed = parseClubValues(values);
    return parsed.success ? {} : fieldErrors(parsed.error, FIELD_MESSAGES);
}
