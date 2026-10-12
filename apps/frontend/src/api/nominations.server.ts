import 'server-only';

import { type TCloseNomination, type TSubmitNomination } from '@pickflick/contracts';

import { apiRequest } from '@/lib/api.server';

export async function submitNomination(id: string, input: TSubmitNomination) {
    return apiRequest(`/sessions/${id}/nominations`, { method: 'POST', json: input });
}
export async function closeNominations(id: string, input: TCloseNomination) {
    return apiRequest(`/sessions/${id}/nominations/close`, { method: 'POST', json: input });
}
