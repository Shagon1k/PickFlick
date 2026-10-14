'use server';

import {
    HTTP_STATUS,
    respondInvitationSchema,
    type TInvitationPreview,
} from '@pickflick/contracts';

import { respondInvitation } from '@/api/invitations.server';
import { ApiError } from '@/lib/api.server';

export async function respondInvitationAction(
    input: unknown,
): Promise<TInvitationPreview | { state: 'sign-in' | 'error' }> {
    const parsed = respondInvitationSchema.safeParse(input);
    if (!parsed.success) return { state: 'invalid' };
    try {
        return await respondInvitation(parsed.data);
    } catch (error) {
        return {
            state:
                error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED
                    ? 'sign-in'
                    : 'error',
        };
    }
}
