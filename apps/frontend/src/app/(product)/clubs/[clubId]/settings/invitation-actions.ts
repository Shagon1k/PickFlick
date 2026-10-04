'use server';

import type { ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';
import { z } from 'zod';

type TInvitationResult =
    | { ok: false; message: string }
    | { ok: true; invitations: IManagedInvitation[]; created?: ICreatedInvitation };

import { createInvitation, listInvitations, revokeInvitation } from '@/api/invitations.server';
import { ApiError } from '@/lib/api.server';

function failure(error: unknown): string {
    if (error instanceof ApiError && error.reason === 'MEMBER_LIMIT_REACHED')
        return 'This Club has reached its member limit.';
    if (error instanceof ApiError && [401, 403, 404].includes(error.status))
        return 'Invitation management is no longer available to you.';
    return 'Invitations could not be updated. Check your connection and try again.';
}

export async function manageInvitationsAction(
    clubId: string,
    inviteId?: string,
): Promise<TInvitationResult> {
    if (
        !z.uuid().safeParse(clubId).success ||
        (inviteId && !z.uuid().safeParse(inviteId).success)
    ) {
        return { ok: false as const, message: 'Invitation unavailable.' };
    }
    try {
        if (inviteId) {
            await revokeInvitation(clubId, inviteId);
            return { ok: true as const, invitations: await listInvitations(clubId) };
        }
        const created = await createInvitation(clubId);
        return { ok: true as const, created, invitations: await listInvitations(clubId) };
    } catch (error) {
        return { ok: false as const, message: failure(error) };
    }
}

export async function loadInvitationsAction(clubId: string): Promise<TInvitationResult> {
    if (!z.uuid().safeParse(clubId).success)
        return { ok: false as const, message: 'Invitation unavailable.' };
    try {
        return { ok: true as const, invitations: await listInvitations(clubId) };
    } catch (error) {
        return { ok: false as const, message: failure(error) };
    }
}
