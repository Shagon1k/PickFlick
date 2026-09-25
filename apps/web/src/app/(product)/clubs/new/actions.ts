'use server';

import { createClub } from '@/api/clubs.server';
import type { TClubFieldName } from '@/components/clubs/club-form.types';
import {
    clubValues,
    parseClubValues,
    validateClubValues,
} from '@/components/clubs/club-form.validation';
import type { FormActionState } from '@/components/forms/form-action.types';
import { ApiError } from '@/lib/api.server';

type TCreateClubState = FormActionState<TClubFieldName>;

function result(
    previous: TCreateClubState,
    state: Omit<TCreateClubState, 'revision'>,
): TCreateClubState {
    return { ...state, revision: previous.revision + 1 };
}

function failureMessage(error: unknown): Pick<TCreateClubState, 'message' | 'tone'> {
    if (error instanceof ApiError && error.status === 401) {
        return {
            message: 'Your session expired. Sign in again; your entries are still here.',
            tone: 'warning',
        };
    }
    if (error instanceof ApiError && error.reason === 'ADMIN_CLUB_LIMIT_REACHED') {
        return {
            message:
                'You already administer the most active Clubs your plan allows. Your entries are still here.',
            tone: 'warning',
        };
    }
    return {
        message: "We couldn't create the Club. Your entries are still here — try again.",
        tone: 'danger',
    };
}

export async function createClubAction(
    previous: TCreateClubState,
    formData: FormData,
): Promise<TCreateClubState> {
    const values = clubValues(formData);
    const parsed = parseClubValues(values);
    if (!parsed.success) {
        return result(previous, {
            status: 'error',
            message: 'Review the highlighted fields and try again.',
            tone: 'danger',
            fieldErrors: validateClubValues(values),
        });
    }

    try {
        await createClub(parsed.data);
        return result(previous, {
            status: 'success',
            message: 'Club created. Opening your screening room…',
            tone: 'success',
        });
    } catch (error) {
        return result(previous, { status: 'error', ...failureMessage(error) });
    }
}
