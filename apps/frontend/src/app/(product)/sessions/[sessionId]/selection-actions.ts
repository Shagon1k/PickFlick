'use server';

import { HTTP_STATUS, submitSelectionSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { submitSelection } from '#api/selection.server';
import { getFailureMessage, type IFailureCopy } from '#lib/action-failure';
import type { TFormResult } from '#lib/form-errors';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

const SELECTION_FAILURE: IFailureCopy = {
    reasons: {
        ALREADY_SUBMITTED: 'Your ballot was already submitted. Refresh to see your saved scores.',
        INCOMPLETE_BALLOT: 'Score every nomination exactly once before submitting.',
        SCORE_OUT_OF_RANGE: 'Choose scores within this Session’s scale.',
    },
    statuses: [
        [
            [HTTP_STATUS.CONFLICT],
            'Selection is unavailable or this Session changed. Refresh before trying again.',
        ],
        [ACCESS_LOST_STATUSES, 'You no longer have permission to submit this ballot.'],
    ],
    fallback: 'We could not save your ballot. Your scores are still here; try again.',
    request: 'Selection request',
};

export async function submitSelectionAction(
    id: string,
    input: unknown,
): Promise<TFormResult<'scores'>> {
    const parsed = submitSelectionSchema.safeParse(input);
    if (!parsed.success)
        return { ok: false, message: 'Choose a valid score for every nomination.', tone: 'danger' };
    try {
        await submitSelection(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        return { ok: true };
    } catch (error) {
        return { ok: false, message: getFailureMessage(error, SELECTION_FAILURE), tone: 'danger' };
    }
}

export async function refreshSelectionAction(id: string) {
    revalidatePath(`/sessions/${id}`);
}
