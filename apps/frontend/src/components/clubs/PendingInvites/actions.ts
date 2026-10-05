'use server';

import {
    invitationDecisionSchema,
    type IPendingClubInvitation,
    type TInvitationPreview,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ApiError, apiRequest } from '@/lib/api.server';

export async function loadPendingInvitesAction(): Promise<{
    invitations?: IPendingClubInvitation[];
    message?: string;
}> {
    try {
        return {
            invitations: await apiRequest<IPendingClubInvitation[]>('/club-invitations/pending'),
        };
    } catch (error) {
        return {
            message:
                error instanceof ApiError && error.status === 401
                    ? 'Sign in again to view pending invites.'
                    : 'Pending invites could not be loaded. Check your connection and retry.',
        };
    }
}

export async function respondPendingInviteAction(
    id: string,
    decision: unknown,
): Promise<{ message: string; resolved: boolean }> {
    const parsed = invitationDecisionSchema.safeParse({ decision });
    if (!parsed.success) return { message: 'Choose Accept or Decline.', resolved: false };
    let result: TInvitationPreview;
    try {
        result = await apiRequest(`/club-invitations/${encodeURIComponent(id)}/respond`, {
            method: 'POST',
            json: parsed.data,
        });
    } catch {
        return {
            message: 'The response could not be confirmed. Retry to check its current state.',
            resolved: false,
        };
    }
    if (result.state === 'accepted' || result.state === 'already-member') {
        revalidatePath('/app');
        redirect(`/clubs/${result.clubId}`);
    }
    return {
        message:
            result.state === 'declined'
                ? 'Invitation declined.'
                : 'This invitation is no longer available.',
        resolved: true,
    };
}
