import 'server-only';

import {
    type ICreatedInvitation,
    type IPendingClubInvitation,
    type IPendingSessionInvitation,
    type ISessionRoster,
    type TInvitationDecision,
    type TInvitationPreview,
    type TRespondInvitation,
    type TSessionInvitationPreview,
} from '@pickflick/contracts';

import { requestApi } from '@/lib/api.server';

export const getSessionRoster = (id: string): Promise<ISessionRoster> =>
    requestApi(`/sessions/${id}/roster`);
export const createSessionInvitation = (
    id: string,
    membershipId: string,
): Promise<ICreatedInvitation> =>
    requestApi(`/sessions/${id}/invitations`, { method: 'POST', json: { membershipId } });
export const revokeSessionInvitation = (id: string, inviteId: string): Promise<void> =>
    requestApi(`/sessions/${id}/invitations/${inviteId}/revoke`, { method: 'POST' });
export const leaveSession = (id: string): Promise<void> =>
    requestApi(`/sessions/${id}/leave`, { method: 'POST', json: { confirmation: 'LEAVE' } });
export const removeSessionParticipant = (id: string, participantId: string): Promise<void> =>
    requestApi(`/sessions/${id}/participants/${participantId}/remove`, {
        method: 'POST',
        json: { confirmation: 'REMOVE' },
    });
export const previewSessionInvitation = (token: string): Promise<TSessionInvitationPreview> =>
    requestApi('/session-invitations/preview', { method: 'POST', json: { token } });
export const respondSessionInvitation = (
    input: TRespondInvitation,
): Promise<TSessionInvitationPreview> =>
    requestApi('/session-invitations/respond', { method: 'POST', json: input });
export const listPendingClubInvitations = (): Promise<IPendingClubInvitation[]> =>
    requestApi('/club-invitations/pending');
export const listPendingSessionInvitations = (): Promise<IPendingSessionInvitation[]> =>
    requestApi('/session-invitations/pending');
export const respondPendingClubInvitation = (
    id: string,
    input: TInvitationDecision,
): Promise<TInvitationPreview> =>
    requestApi(`/club-invitations/${id}/respond`, { method: 'POST', json: input });
export const respondPendingSessionInvitation = (
    id: string,
    input: TInvitationDecision,
): Promise<TSessionInvitationPreview> =>
    requestApi(`/session-invitations/${id}/respond`, { method: 'POST', json: input });
