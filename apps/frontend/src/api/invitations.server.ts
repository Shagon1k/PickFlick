import 'server-only';

import {
    type ICreatedInvitation,
    type IManagedInvitation,
    invitationPreviewSchema,
    type TRespondInvitation,
} from '@pickflick/contracts';

import { requestApi } from '@/lib/api.server';

export async function previewInvitation(token: string) {
    return invitationPreviewSchema.parse(
        await requestApi('/club-invitations/preview', {
            method: 'POST',
            json: { token },
        }),
    );
}
export async function respondInvitation(input: TRespondInvitation) {
    return invitationPreviewSchema.parse(
        await requestApi('/club-invitations/respond', {
            method: 'POST',
            json: input,
        }),
    );
}
export const createInvitation = (clubId: string): Promise<ICreatedInvitation> =>
    requestApi(`/clubs/${clubId}/invitations`, { method: 'POST', json: {} });
export const listInvitations = (clubId: string): Promise<IManagedInvitation[]> =>
    requestApi(`/clubs/${clubId}/invitations`);
export const revokeInvitation = (clubId: string, inviteId: string): Promise<void> =>
    requestApi(`/clubs/${clubId}/invitations/${inviteId}/revoke`, { method: 'POST' });
