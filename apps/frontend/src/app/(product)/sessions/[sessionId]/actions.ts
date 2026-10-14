'use server';

import { cancelSessionSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { cancelSession } from '@/api/sessions.server';
import { ApiError } from '@/lib/api.server';
import { ACCESS_LOST_STATUSES } from '@/lib/http-status';

export async function cancelSessionAction(id: string, input: unknown) {
    if (!z.uuid().safeParse(id).success)
        return { ok: false, message: 'This Session address is invalid.' };
    const parsed = cancelSessionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Type CANCEL to confirm.' };
    try {
        const session = await cancelSession(id, parsed.data);
        revalidatePath(`/clubs/${session.clubId}`);
        revalidatePath(`/sessions/${id}`);
        return { ok: true, message: 'Session cancelled.' };
    } catch (error) {
        if (error instanceof ApiError && error.reason === 'SESSION_CHANGED')
            return { ok: false, message: 'This Session changed. Reload before cancelling.' };
        if (error instanceof ApiError && ACCESS_LOST_STATUSES.includes(error.status))
            return { ok: false, message: 'You no longer have permission to cancel this Session.' };
        console.error('Session cancellation failed.');
        return { ok: false, message: 'We could not cancel this Session. Try again.' };
    }
}
