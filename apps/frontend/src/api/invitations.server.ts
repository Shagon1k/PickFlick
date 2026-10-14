import 'server-only';

import {
    type ICreatedInvitation,
    type IManagedInvitation,
    type TInvitationPreview,
    type TRespondInvitation,
} from '@pickflick/contracts';

import { apiPath, requestApi } from '@/lib/api.server';

export const previewInvitation = (token: string): Promise<TInvitationPreview> =>
    requestApi('/club-invitations/preview', { method: 'POST', json: { token } });
export const respondInvitation = (input: TRespondInvitation): Promise<TInvitationPreview> =>
    requestApi('/club-invitations/respond', { method: 'POST', json: input });
export const createInvitation = (clubId: string): Promise<ICreatedInvitation> =>
    requestApi(apiPath`/clubs/${clubId}/invitations`, { method: 'POST', json: {} });
export const listInvitations = (clubId: string): Promise<IManagedInvitation[]> =>
    requestApi(apiPath`/clubs/${clubId}/invitations`);
export const revokeInvitation = (clubId: string, inviteId: string): Promise<void> =>
    requestApi(apiPath`/clubs/${clubId}/invitations/${inviteId}/revoke`, { method: 'POST' });
