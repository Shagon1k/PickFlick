'use server';

import { cancelSessionSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { cancelSession } from '#api/sessions.server';
import { getFailureMessage } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

export async function cancelSessionAction(id: string, input: unknown) {
    const parsed = cancelSessionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Type CANCEL to confirm.' };
    try {
        const session = await cancelSession(id, parsed.data);
        revalidatePath(`/clubs/${session.clubId}`);
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
