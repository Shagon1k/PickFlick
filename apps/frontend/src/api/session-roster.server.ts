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

import { apiPath, requestApi } from '#lib/api.server';

export const getSessionRoster = (id: string): Promise<ISessionRoster> =>
    requestApi(apiPath`/sessions/${id}/roster`);
export const joinSession = (id: string): Promise<TSessionInvitationPreview> =>
    requestApi(apiPath`/sessions/${id}/participation`, {
        method: 'POST',
        json: { decision: 'accept' },
    });
export const createSessionInvitation = (
    id: string,
    membershipId: string,
): Promise<ICreatedInvitation> =>
    requestApi(apiPath`/sessions/${id}/invitations`, { method: 'POST', json: { membershipId } });
export const revokeSessionInvitation = (id: string, inviteId: string): Promise<void> =>
    requestApi(apiPath`/sessions/${id}/invitations/${inviteId}/revoke`, { method: 'POST' });
export const leaveSession = (id: string): Promise<void> =>
    requestApi(apiPath`/sessions/${id}/leave`, { method: 'POST', json: { confirmation: 'LEAVE' } });
export const removeSessionParticipant = (id: string, participantId: string): Promise<void> =>
    requestApi(apiPath`/sessions/${id}/participants/${participantId}/remove`, {
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
    requestApi(apiPath`/club-invitations/${id}/respond`, { method: 'POST', json: input });
export const respondPendingSessionInvitation = (
    id: string,
    input: TInvitationDecision,
): Promise<TSessionInvitationPreview> =>
    requestApi(apiPath`/sessions/${id}/participation`, { method: 'POST', json: input });
