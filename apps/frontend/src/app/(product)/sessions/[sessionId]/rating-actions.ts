'use server';

import { closeRatingSchema, HTTP_STATUS, submitRatingSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { closeRating, submitRating } from '#api/rating.server';
import { getFailureMessage, type IFailureCopy } from '#lib/action-failure';
import type { TFormResult } from '#lib/form-errors';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

const RATING_FAILURE: IFailureCopy = {
    reasons: {
        CLUB_ARCHIVED: 'This Club is archived. Session changes are paused until it is reactivated.',
        RATING_MOVIE_MISSING:
            'This Session has no selected Movie. Refresh and ask a Club operator to check it.',
        ALREADY_SUBMITTED: 'Your rating is already saved and cannot be changed. Refresh to see it.',
        RATING_CLOSED: 'Rating has closed. Refresh to see the completed Session.',
        RATING_CHANGED: 'This Session changed. Refresh before closing Rating.',
    },
    statuses: [
        [
            [HTTP_STATUS.CONFLICT],
            'Rating is unavailable or this Session changed. Refresh before trying again.',
        ],
        [ACCESS_LOST_STATUSES, 'You no longer have permission to change Rating.'],
    ],
    fallback: 'We could not save your rating. Your input is still here; try again.',
    request: 'Rating request',
};

export async function submitRatingAction(
    id: string,
    input: unknown,
): Promise<TFormResult<'score' | 'comment'>> {
    const parsed = submitRatingSchema.safeParse(input);
    if (!parsed.success)
        return {
            ok: false,
            message: 'Choose a rating from 1 to 10 and a comment up to 2000 characters.',
            tone: 'danger',
        };
    try {
        await submitRating(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        revalidatePath('/clubs/[clubId]', 'layout');
        return { ok: true };
    } catch (error) {
        return { ok: false, message: getFailureMessage(error, RATING_FAILURE), tone: 'danger' };
    }
}

export async function closeRatingAction(
    id: string,
    input: unknown,
): Promise<TFormResult<'confirmation'>> {
    const parsed = closeRatingSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Type CLOSE to confirm.', tone: 'danger' };
    try {
        await closeRating(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        revalidatePath('/clubs/[clubId]', 'layout');
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            message: getFailureMessage(error, {
                ...RATING_FAILURE,
                fallback: 'We could not close Rating. Try again.',
            }),
            tone: 'danger',
        };
    }
}
