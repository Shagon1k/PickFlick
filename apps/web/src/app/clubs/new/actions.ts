'use server';

import { headers } from 'next/headers';

import type { CreateClubRequest } from '@pickflick/contracts';

import { submitClubCreation } from '../../../components/clubs/club-api';
import { clubValues, validateClubValues } from '../../../components/clubs/club-form.validation';
import type { ClubFieldName } from '../../../components/clubs/club-form.types';
import type { FormActionState } from '../../../components/forms/form-action.types';

function result(
    previous: FormActionState<ClubFieldName>,
    state: Omit<FormActionState<ClubFieldName>, 'revision'>,
): FormActionState<ClubFieldName> {
    return { ...state, revision: previous.revision + 1 };
}

export async function createClub(
    previous: FormActionState<ClubFieldName>,
    formData: FormData,
): Promise<FormActionState<ClubFieldName>> {
    const values = clubValues(formData);
    const fieldErrors = validateClubValues(values);
    if (Object.keys(fieldErrors).length > 0) {
        return result(previous, {
            status: 'error',
            message: 'Review the highlighted fields and try again.',
            tone: 'danger',
            fieldErrors,
        });
    }

    const payload: CreateClubRequest = {
        name: values.name,
        ...(values.description.trim() ? { description: values.description } : {}),
        selectionScaleMin: Number(values.selectionScaleMin) as 0 | 1,
        selectionScaleMax: Number(values.selectionScaleMax),
    };
    const response = await submitClubCreation(await headers(), payload);
    if (response.ok) {
        return result(previous, {
            status: 'success',
            message: 'Club created. Opening your screening room…',
            tone: 'success',
        });
    }
    if (response.status === 401) {
        return result(previous, {
            status: 'error',
            message: 'Your session expired. Sign in again; your entries are still here.',
            tone: 'warning',
        });
    }
    if (response.status === 409) {
        return result(previous, {
            status: 'error',
            message:
                response.reason === 'ADMIN_CLUB_LIMIT_REACHED'
                    ? 'You already administer the most active Clubs your plan allows. Your entries are still here.'
                    : "We couldn't create the Club right now. Your entries are still here — try again.",
            tone: 'warning',
        });
    }
    return result(previous, {
        status: 'error',
        message: "We couldn't create the Club. Your entries are still here — try again.",
        tone: 'danger',
    });
}
