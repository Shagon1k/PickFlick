'use server';

import { cancelSessionSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { cancelSession } from '@/api/sessions.server';
import { apiFailureMessage } from '@/lib/api-failure.server';

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
        const permission = 'You no longer have permission to cancel this Session.';
        const message = apiFailureMessage(error, {
            reasons: { SESSION_CHANGED: 'This Session changed. Reload before cancelling.' },
            statuses: { 401: permission, 403: permission, 404: permission },
        });
        if (message) return { ok: false, message };
        console.error('Session cancellation failed.');
        return { ok: false, message: 'We could not cancel this Session. Try again.' };
    }
}
