'use server';

import { closeNominationSchema, HTTP_STATUS, submitNominationSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { closeNominations, submitNomination } from '#api/nominations.server';
import { getFailureMessage, type IFailureCopy } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

const NOMINATION_FAILURE: IFailureCopy = {
    reasons: {
        ALREADY_NOMINATED: 'You already nominated a Movie. Refresh to see your nomination.',
    },
    statuses: [
        [
            [HTTP_STATUS.CONFLICT],
            'This Session changed or nominations are unavailable. Refresh before trying again.',
        ],
        [ACCESS_LOST_STATUSES, 'You no longer have permission for this action.'],
    ],
    fallback: 'We could not save this action. Your selection is still here; try again.',
    request: 'Nomination request',
};

export async function refreshNominationsAction(id: string) {
    revalidatePath(`/sessions/${id}`);
    return { ok: true as const, message: 'Nominations refreshed.' };
}
export async function nominateAction(id: string, input: unknown) {
    const parsed = submitNominationSchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, message: 'Choose a Movie first.' };
    try {
        await submitNomination(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        return { ok: true as const, message: 'Your nomination is confirmed.' };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error, NOMINATION_FAILURE) };
    }
}
export async function closeNominationsAction(id: string, input: unknown) {
    const parsed = closeNominationSchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, message: 'Type CLOSE to confirm.' };
    try {
        await closeNominations(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        // Manage Club offers the same closure, so every Club Hub view refreshes too.
        revalidatePath('/clubs/[clubId]', 'layout');
        return { ok: true as const, message: 'Nominations closed.' };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error, NOMINATION_FAILURE) };
    }
}
