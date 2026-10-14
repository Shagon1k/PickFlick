'use server';

import {
    HTTP_STATUS,
    invitationDecisionSchema,
    type TPendingInvitation,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
    listPendingClubInvitations,
    listPendingSessionInvitations,
    respondPendingClubInvitation,
    respondPendingSessionInvitation,
} from '#api/session-roster.server';
import { ApiError } from '#lib/api.server';

export async function loadPendingInvitesAction(): Promise<{
    invitations?: TPendingInvitation[];
    message?: string;
}> {
    try {
        const [clubs, sessions] = await Promise.all([
            listPendingClubInvitations(),
            listPendingSessionInvitations(),
        ]);
        return {
            invitations: [
                ...clubs.map((invite) => ({ ...invite, kind: 'club' as const })),
                ...sessions.map((invite) => ({ ...invite, kind: 'session' as const })),
            ],
        };
    } catch (error) {
        return {
            message:
                error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED
                    ? 'Sign in again to view pending invites.'
                    : 'Pending invites could not be loaded. Check your connection and retry.',
        };
    }
}

export async function respondPendingInviteAction(
    id: string,
    decision: unknown,
    kind: 'club' | 'session',
): Promise<{ message: string; resolved: boolean }> {
    const parsed = invitationDecisionSchema.safeParse({ decision });
    if (!parsed.success) return { message: 'Choose Accept or Decline.', resolved: false };
    let result;
    try {
        result =
            kind === 'session'
                ? await respondPendingSessionInvitation(encodeURIComponent(id), parsed.data)
                : await respondPendingClubInvitation(encodeURIComponent(id), parsed.data);
    } catch {
        return {
            message: 'The response could not be confirmed. Retry to check its current state.',
            resolved: false,
        };
    }
    if (result.state === 'accepted' || result.state === 'already-member') {
        revalidatePath('/app');
        revalidatePath(`/clubs/${result.clubId}`);
        if ('sessionId' in result && typeof result.sessionId === 'string') {
            revalidatePath(`/sessions/${result.sessionId}`);
            redirect(`/sessions/${result.sessionId}`);
        }
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
