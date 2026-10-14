import 'server-only';

import type {
    TCancelSession,
    TCreateSession,
    TSession,
    TSessionProgress,
    TUpdateSession,
} from '@pickflick/contracts';

import { requestApi } from '@/lib/api.server';

export const getSession = (id: string): Promise<TSession> => requestApi(`/sessions/${id}`);
export const createSession = (clubId: string, input: TCreateSession): Promise<TSession> =>
    requestApi(`/clubs/${clubId}/sessions`, { method: 'POST', json: input });
export const updateSession = (id: string, input: TUpdateSession): Promise<TSession> =>
    requestApi(`/sessions/${id}`, { method: 'PATCH', json: input });
export const cancelSession = (id: string, input: TCancelSession): Promise<TSession> =>
    requestApi(`/sessions/${id}/cancel`, { method: 'POST', json: input });
export const getSessionProgress = (id: string): Promise<TSessionProgress> =>
    requestApi(`/sessions/${id}/progress`);
