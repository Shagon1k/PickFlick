import 'server-only';

import {
    sessionSchema,
    type TCancelSession,
    type TCreateSession,
    type TUpdateSession,
} from '@pickflick/contracts';

import { apiRequest } from '@/lib/api.server';

export async function getSession(id: string) {
    return sessionSchema.parse(await apiRequest(`/sessions/${id}`));
}
export async function createSession(clubId: string, input: TCreateSession) {
    return sessionSchema.parse(
        await apiRequest(`/clubs/${clubId}/sessions`, { method: 'POST', json: input }),
    );
}
export async function updateSession(id: string, input: TUpdateSession) {
    return sessionSchema.parse(
        await apiRequest(`/sessions/${id}`, { method: 'PATCH', json: input }),
    );
}
export async function cancelSession(id: string, input: TCancelSession) {
    return sessionSchema.parse(
        await apiRequest(`/sessions/${id}/cancel`, { method: 'POST', json: input }),
    );
}
