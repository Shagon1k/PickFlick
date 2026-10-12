'use server';

import { closeNominationSchema, submitNominationSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { closeNominations, getNominations, submitNomination } from '@/api/nominations.server';
import { getSession } from '@/api/sessions.server';
import { ApiError } from '@/lib/api.server';

export async function readNominationsAction(id: string) {
    if (!z.uuidv4().safeParse(id).success)
        return { ok: false as const, message: 'This Session address is invalid.' };
    try {
        return { ok: true as const, data: await getNominations(id) };
    } catch {
        return { ok: false as const, message: 'We could not refresh nominations. Try again.' };
    }
}
export async function nominateAction(id: string, input: unknown) {
    const parsed = submitNominationSchema.safeParse(input);
    if (!z.uuidv4().safeParse(id).success || !parsed.success)
        return { ok: false as const, message: 'Choose a Movie first.' };
    try {
        const data = await submitNomination(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        return { ok: true as const, data, message: 'Your nomination is confirmed.' };
    } catch (error) {
        return nominationError(error);
    }
}
export async function closeNominationsAction(id: string, input: unknown) {
    const parsed = closeNominationSchema.safeParse(input);
    if (!z.uuidv4().safeParse(id).success || !parsed.success)
        return { ok: false as const, message: 'Type CLOSE to confirm.' };
    try {
        const session = await getSession(id);
        const data = await closeNominations(id, parsed.data);
        revalidatePath(`/sessions/${id}`);
        revalidatePath(`/clubs/${session.clubId}`);
        return { ok: true as const, data, message: 'Nominations closed.' };
    } catch (error) {
        return nominationError(error);
    }
}
function nominationError(error: unknown) {
    if (error instanceof ApiError) {
        if (error.reason === 'ALREADY_NOMINATED')
            return {
                ok: false as const,
                message: 'You already nominated a Movie. Refresh to see your nomination.',
            };
        if (error.status === 409)
            return {
                ok: false as const,
                message:
                    'This Session changed or nominations are unavailable. Refresh before trying again.',
            };
        if ([401, 403, 404].includes(error.status))
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
