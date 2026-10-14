'use server';

import type { ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';

import { createInvitation, listInvitations, revokeInvitation } from '#api/invitations.server';
import { getFailureMessage, type IFailureCopy } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

type TInvitationResult =
    | { ok: false; message: string }
    | {
          ok: true;
          invitations?: IManagedInvitation[];
          created?: ICreatedInvitation;
          refreshError?: string;
      };

const INVITATION_FAILURE: IFailureCopy = {
    reasons: { MEMBER_LIMIT_REACHED: 'This Club has reached its member limit.' },
    statuses: [[ACCESS_LOST_STATUSES, 'Invitation management is no longer available to you.']],
    fallback: 'Invitations could not be updated. Check your connection and try again.',
    request: 'Club invitation request',
};

export async function manageInvitationsAction(
    clubId: string,
    inviteId?: string,
): Promise<TInvitationResult> {
    try {
        if (inviteId) {
            await revokeInvitation(clubId, inviteId);
            return { ok: true as const, invitations: await listInvitations(clubId) };
        }
        const created = await createInvitation(clubId);
        const refreshed = await loadInvitationsAction(clubId);
        return refreshed.ok
            ? { ok: true as const, created, invitations: refreshed.invitations }
            : {
                  ok: true as const,
                  created,
                  refreshError:
                      'Invitation list could not be refreshed. Use Recent invitations to try again.',
              };
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
