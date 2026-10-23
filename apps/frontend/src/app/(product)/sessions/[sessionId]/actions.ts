'use server';

import { cancelSessionSchema, HTTP_STATUS, openRatingSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { cancelSession, openRating } from '#api/sessions.server';
import { getFailureMessage } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

export async function openRatingAction(id: string, input: unknown) {
    const parsed = openRatingSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Type OPEN to confirm.' };
    try {
        await openRating(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        revalidatePath('/clubs/[clubId]', 'layout');
        return { ok: true, message: 'Rating is open.' };
    } catch (error) {
        return {
            ok: false,
            message: getFailureMessage(error, {
                reasons: {
                    WATCHING_CHANGED: 'This Session changed. Refresh before opening Rating.',
                    CLUB_READ_ONLY: 'This Club is read-only. Rating cannot be opened right now.',
                },
                statuses: [
                    [ACCESS_LOST_STATUSES, 'You no longer have permission to open Rating.'],
                    [
                        [HTTP_STATUS.CONFLICT],
                        'This Session changed. Refresh before opening Rating.',
                    ],
                ],
                fallback: 'We could not open Rating. Try again.',
                request: 'Open Rating',
            }),
        };
    }
}

export async function cancelSessionAction(id: string, input: unknown) {
    const parsed = cancelSessionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Type CANCEL to confirm.' };
    try {
        const session = await cancelSession(id, parsed.data);
        revalidatePath(`/clubs/${session.clubId}`, 'layout');
        revalidatePath(`/sessions/${id}`);
        return { ok: true, message: 'Session cancelled.' };
    } catch (error) {
        const message = getFailureMessage(error, {
            reasons: { SESSION_CHANGED: 'This Session changed. Reload before cancelling.' },
            statuses: [
                [ACCESS_LOST_STATUSES, 'You no longer have permission to cancel this Session.'],
            ],
            fallback: 'We could not cancel this Session. Try again.',
            request: 'Session cancellation',
        });
        return { ok: false, message };
    }
}
