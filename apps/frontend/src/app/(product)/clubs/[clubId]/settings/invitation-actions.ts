'use server';

import type { ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';

type TInvitationResult =
    | { ok: false; message: string }
    | {
          ok: true;
          invitations?: IManagedInvitation[];
          created?: ICreatedInvitation;
          refreshError?: string;
      };

import { createInvitation, listInvitations, revokeInvitation } from '@/api/invitations.server';
import { ApiError } from '@/lib/api.server';
import { ACCESS_LOST_STATUSES } from '@/lib/http-status';

function getFailureMessage(error: unknown): string {
    if (error instanceof ApiError && error.reason === 'MEMBER_LIMIT_REACHED')
        return 'This Club has reached its member limit.';
    if (error instanceof ApiError && ACCESS_LOST_STATUSES.includes(error.status))
        return 'Invitation management is no longer available to you.';
    return 'Invitations could not be updated. Check your connection and try again.';
}

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
        return { ok: false as const, message: getFailureMessage(error) };
    }
}

export async function loadInvitationsAction(clubId: string): Promise<TInvitationResult> {
    try {
        return { ok: true as const, invitations: await listInvitations(clubId) };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error) };
    }
}
