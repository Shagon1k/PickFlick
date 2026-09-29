'use server';

import { cookies } from 'next/headers';

import { createClub } from '@/api/clubs.server';
import type { IClubFormValues, TClubFieldName } from '@/components/clubs/club-form.types';
import { parseClubValues, validateClubValues } from '@/components/clubs/club-form.validation';
import { ApiError } from '@/lib/api.server';
import type { TFormResult } from '@/lib/form-errors';

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
        (await cookies()).set('pickflick.last_club', club.id, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        });
        return { ok: true };
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
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
            message: "We couldn't create the Club. Your entries are still here — try again.",
            tone: 'danger',
        };
    }
}
