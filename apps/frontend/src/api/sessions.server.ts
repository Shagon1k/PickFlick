import 'server-only';

import type {
    TCancelSession,
    TCreatePastSession,
    TCreateSession,
    TOpenRating,
    TPastSessionMembers,
    TSession,
    TSessionProgress,
    TUpdateSession,
} from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const getSession = (id: string): Promise<TSession> => requestApi(apiPath`/sessions/${id}`);
export const getPastSessionMembers = (clubId: string): Promise<TPastSessionMembers> =>
    requestApi(apiPath`/clubs/${clubId}/sessions/past/members`);
export const createPastSession = (clubId: string, input: TCreatePastSession): Promise<TSession> =>
    requestApi(apiPath`/clubs/${clubId}/sessions/past`, { method: 'POST', json: input });
export const createSession = (clubId: string, input: TCreateSession): Promise<TSession> =>
    requestApi(apiPath`/clubs/${clubId}/sessions`, { method: 'POST', json: input });
export const updateSession = (id: string, input: TUpdateSession): Promise<TSession> =>
    requestApi(apiPath`/sessions/${id}`, { method: 'PATCH', json: input });
export const cancelSession = (id: string, input: TCancelSession): Promise<TSession> =>
    requestApi(apiPath`/sessions/${id}/cancel`, { method: 'POST', json: input });
export const getSessionProgress = (id: string): Promise<TSessionProgress> =>
    requestApi(apiPath`/sessions/${id}/progress`);

export const openRating = (id: string, input: TOpenRating): Promise<void> =>
    requestApi(apiPath`/sessions/${id}/rating/open`, { method: 'POST', json: input });
