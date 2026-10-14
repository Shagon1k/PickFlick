'use server';

import { closeNominationSchema, HTTP_STATUS, submitNominationSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { closeNominations, submitNomination } from '@/api/nominations.server';
import { ApiError } from '@/lib/api.server';
import { ACCESS_LOST_STATUSES } from '@/lib/http-status';

export async function refreshNominationsAction(id: string) {
    if (!z.uuidv4().safeParse(id).success)
        return { ok: false as const, message: 'This Session address is invalid.' };
    revalidatePath(`/sessions/${id}`);
    return { ok: true as const, message: 'Nominations refreshed.' };
}
export async function nominateAction(id: string, input: unknown) {
    const parsed = submitNominationSchema.safeParse(input);
    if (!z.uuidv4().safeParse(id).success || !parsed.success)
        return { ok: false as const, message: 'Choose a Movie first.' };
    try {
        await submitNomination(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        return { ok: true as const, message: 'Your nomination is confirmed.' };
    } catch (error) {
        return getNominationErrorMessage(error);
    }
}
export async function closeNominationsAction(id: string, input: unknown) {
    const parsed = closeNominationSchema.safeParse(input);
    if (!z.uuidv4().safeParse(id).success || !parsed.success)
        return { ok: false as const, message: 'Type CLOSE to confirm.' };
    try {
        await closeNominations(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        return { ok: true as const, message: 'Nominations closed.' };
    } catch (error) {
        return getNominationErrorMessage(error);
    }
}
function getNominationErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.reason === 'ALREADY_NOMINATED')
            return {
                ok: false as const,
                message: 'You already nominated a Movie. Refresh to see your nomination.',
            };
        if (error.status === HTTP_STATUS.CONFLICT)
            return {
                ok: false as const,
                message:
                    'This Session changed or nominations are unavailable. Refresh before trying again.',
            };
        if (ACCESS_LOST_STATUSES.includes(error.status))
            return {
                ok: false as const,
                message: 'You no longer have permission for this action.',
            };
    }
    console.error('Nomination request failed.');
    return {
        ok: false as const,
        message: 'We could not save this action. Your selection is still here; try again.',
    };
}
