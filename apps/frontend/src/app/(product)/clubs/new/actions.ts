'use server';

import { HTTP_STATUS } from '@pickflick/contracts';
import { cookies } from 'next/headers';

import { createClub } from '#api/clubs.server';
import type { IClubFormValues, TClubFieldName } from '#components/clubs/club-form.types';
import { parseClubValues, validateClubValues } from '#components/clubs/club-form.validation';
import { getFailureMessage } from '#lib/action-failure';
import { ApiError } from '#lib/api.server';
import type { TFormResult } from '#lib/form-errors';
import { LAST_CLUB_COOKIE, LAST_CLUB_COOKIE_OPTIONS } from '#lib/last-club';

export async function createClubAction(
    values: IClubFormValues,
): Promise<TFormResult<TClubFieldName>> {
    const parsed = parseClubValues(values);
    if (!parsed.success) {
        return {
            ok: false,
            message: 'Review the highlighted fields and try again.',
            tone: 'danger',
            fieldErrors: validateClubValues(values),
        };
    }

    try {
        const club = await createClub(parsed.data);
        (await cookies()).set(LAST_CLUB_COOKIE, club.id, LAST_CLUB_COOKIE_OPTIONS);
        return { ok: true };
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED) {
            return {
                ok: false,
                message: 'Your session expired. Sign in again; your entries are still here.',
                tone: 'warning',
            };
        }
        if (error instanceof ApiError && error.reason === 'ADMIN_CLUB_LIMIT_REACHED') {
            return {
                ok: false,
                message:
                    'You already administer the most active Clubs your plan allows. Your entries are still here.',
                tone: 'warning',
            };
        }
        return {
            ok: false,
            message: getFailureMessage(error, {
                fallback: "We couldn't create the Club. Your entries are still here — try again.",
                request: 'Club creation',
            }),
            tone: 'danger',
        };
    }
}
