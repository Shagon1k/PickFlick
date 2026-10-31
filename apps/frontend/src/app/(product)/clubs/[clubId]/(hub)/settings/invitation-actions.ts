'use server';

import type { ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';

import { createInvitation, listInvitations, revokeInvitation } from '#api/invitations.server';
import { getFailureMessage, type IFailureCopy } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

export type TInvitationResult =
    | { ok: false; message: string }
    | {
          ok: true;
          invitations?: IManagedInvitation[];
          created?: ICreatedInvitation;
          refreshError?: string;
      };

const INVITATION_FAILURE: IFailureCopy = {
    reasons: {
        MEMBER_LIMIT_REACHED: 'This Club has reached its member limit.',
        INVITATION_LIMIT_REACHED:
            'This Club has reached its active invitation limit. Revoke an unused link in Recent invitations, then try again.',
    },
    statuses: [[ACCESS_LOST_STATUSES, 'Invitation management is no longer available to you.']],
    fallback: 'Invitations could not be updated. Check your connection and try again.',
    request: 'Club invitation request',
};

const REFRESH_ERROR =
    'Invitation list could not be refreshed. Use Recent invitations to try again.';

export async function createInvitationAction(clubId: string): Promise<TInvitationResult> {
    try {
        const created = await createInvitation(clubId);
        return { ok: true as const, created, ...(await refreshInvitations(clubId)) };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error, INVITATION_FAILURE) };
    }
}

export async function revokeInvitationAction(
    clubId: string,
    inviteId: string,
): Promise<TInvitationResult> {
    try {
        await revokeInvitation(clubId, inviteId);
        return { ok: true as const, ...(await refreshInvitations(clubId)) };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error, INVITATION_FAILURE) };
    }
}

export async function loadInvitationsAction(clubId: string): Promise<TInvitationResult> {
    try {
        return { ok: true as const, invitations: await listInvitations(clubId) };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error, INVITATION_FAILURE) };
    }
}

// The change already happened; a failed list refresh must not report it as failed.
async function refreshInvitations(clubId: string) {
    const refreshed = await loadInvitationsAction(clubId);
    return refreshed.ok ? { invitations: refreshed.invitations } : { refreshError: REFRESH_ERROR };
}
