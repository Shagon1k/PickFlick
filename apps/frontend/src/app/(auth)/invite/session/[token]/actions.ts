'use server';

import {
    HTTP_STATUS,
    respondInvitationSchema,
    type TSessionInvitationPreview,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { respondSessionInvitation } from '#api/session-roster.server';
import { ApiError } from '#lib/api.server';

export async function respondSessionInvitationAction(
    input: unknown,
): Promise<TSessionInvitationPreview | { state: 'sign-in' | 'error' }> {
    const parsed = respondInvitationSchema.safeParse(input);
    if (!parsed.success) return { state: 'unavailable' };
    try {
        const result = await respondSessionInvitation(parsed.data);
        if (result.state === 'accepted') {
            revalidatePath(`/sessions/${result.sessionId}`);
            revalidatePath(`/clubs/${result.clubId}`);
        }
        revalidatePath('/app');
        return result;
    } catch (error) {
        return {
            state:
                error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED
                    ? 'sign-in'
                    : 'error',
        };
    }
}
