import 'server-only';

import {
    type ICreatedInvitation,
    type IPendingClubInvitation,
    type IPendingSessionInvitation,
    type ISessionRoster,
    sessionInvitationPreviewSchema,
    type TInvitationDecision,
    type TInvitationPreview,
    type TRespondInvitation,
} from '@pickflick/contracts';

import { apiRequest } from '@/lib/api.server';

export const getSessionRoster = (id: string): Promise<ISessionRoster> =>
    apiRequest(`/sessions/${id}/roster`);
export const createSessionInvitation = (
    id: string,
    membershipId: string,
): Promise<ICreatedInvitation> =>
    apiRequest(`/sessions/${id}/invitations`, { method: 'POST', json: { membershipId } });
export const revokeSessionInvitation = (id: string, inviteId: string): Promise<void> =>
    apiRequest(`/sessions/${id}/invitations/${inviteId}/revoke`, { method: 'POST' });
export const leaveSession = (id: string): Promise<void> =>
    apiRequest(`/sessions/${id}/leave`, { method: 'POST', json: { confirmation: 'LEAVE' } });
export const removeSessionParticipant = (id: string, participantId: string): Promise<void> =>
    apiRequest(`/sessions/${id}/participants/${participantId}/remove`, {
        method: 'POST',
        json: { confirmation: 'REMOVE' },
    });
export async function previewSessionInvitation(token: string) {
    return sessionInvitationPreviewSchema.parse(
        await apiRequest('/session-invitations/preview', { method: 'POST', json: { token } }),
    );
}
export async function respondSessionInvitation(input: TRespondInvitation) {
    return sessionInvitationPreviewSchema.parse(
        await apiRequest('/session-invitations/respond', { method: 'POST', json: input }),
    );
}
export const pendingClubInvitations = (): Promise<IPendingClubInvitation[]> =>
    apiRequest('/club-invitations/pending');
export const pendingSessionInvitations = (): Promise<IPendingSessionInvitation[]> =>
    apiRequest('/session-invitations/pending');
export const respondPendingClubInvitation = (
    id: string,
    input: TInvitationDecision,
): Promise<TInvitationPreview> =>
    apiRequest(`/club-invitations/${id}/respond`, { method: 'POST', json: input });
export async function respondPendingSessionInvitation(id: string, input: TInvitationDecision) {
    return sessionInvitationPreviewSchema.parse(
        await apiRequest(`/session-invitations/${id}/respond`, { method: 'POST', json: input }),
    );
}
