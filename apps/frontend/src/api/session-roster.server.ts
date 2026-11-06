import 'server-only';

import {
    type IPendingClubInvitation,
    type IPendingSessionInvitation,
    type ISessionRoster,
    type TInvitationDecision,
    type TInvitationPreview,
    type TSessionParticipationResult,
} from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const getSessionRoster = (id: string): Promise<ISessionRoster> =>
    requestApi(apiPath`/sessions/${id}/roster`);
export const joinSession = (id: string): Promise<TSessionParticipationResult> =>
    requestApi(apiPath`/sessions/${id}/participation`, {
        method: 'POST',
        json: { decision: 'accept' },
    });
export const leaveSession = (id: string): Promise<void> =>
    requestApi(apiPath`/sessions/${id}/leave`, { method: 'POST', json: { confirmation: 'LEAVE' } });
export const removeSessionParticipant = (id: string, participantId: string): Promise<void> =>
    requestApi(apiPath`/sessions/${id}/participants/${participantId}/remove`, {
        method: 'POST',
        json: { confirmation: 'REMOVE' },
    });
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
): Promise<TSessionParticipationResult> =>
    requestApi(apiPath`/sessions/${id}/participation`, { method: 'POST', json: input });
