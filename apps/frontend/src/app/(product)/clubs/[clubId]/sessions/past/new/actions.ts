'use server';

import { createPastSessionSchema, HTTP_STATUS } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { createPastSession } from '#api/sessions.server';
import { getFailureMessage, type IFailureCopy } from '#lib/action-failure';

const SAVE_FAILURE: IFailureCopy = {
    reasons: {
        SUBMISSION_CONFLICT: 'We could not log this Session. Reload the form before trying again.',
        SUBMISSION_MISMATCH:
            'This Session was already logged with different entries. Your changes were not saved. Open Club history to review it.',
        MOVIE_UNAVAILABLE: 'The selected Movie is unavailable. Choose another film.',
        ATTENDEE_UNAVAILABLE:
            'An attendee is unavailable in this Club. Reload the form to review the roster.',
        ATTENDEE_DUPLICATE: 'Select each person only once, even if they rejoined the Club.',
        SCORE_OUT_OF_RANGE:
            'The Club Selection scale changed. Reload the form and review the scores.',
        CLUB_READ_ONLY: 'This Club is read-only. Return to the Club Hub for details.',
    },
    statuses: [
        [
            [HTTP_STATUS.UNAUTHORIZED],
            'Your sign-in expired. Sign in again; your entries are still here.',
        ],
        [
            [HTTP_STATUS.FORBIDDEN, HTTP_STATUS.NOT_FOUND],
            'You no longer have permission to log a past Session in this Club.',
        ],
    ],
    fallback: 'We could not log this Session. Your entries are still here; try again.',
    request: 'Past Session save',
};

export async function savePastSessionAction(clubId: string, input: unknown) {
    const parsed = createPastSessionSchema.safeParse(input);
    if (!parsed.success)
        return { ok: false as const, message: 'Review the highlighted fields and try again.' };
    try {
        const session = await createPastSession(clubId, parsed.data);
        revalidatePath(`/clubs/${clubId}`);
        return { ok: true as const, session };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error, SAVE_FAILURE) };
    }
}
