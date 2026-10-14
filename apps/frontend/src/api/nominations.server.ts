import 'server-only';

import { type TCloseNomination, type TSubmitNomination } from '@pickflick/contracts';

import { apiPath, requestApi } from '@/lib/api.server';

export async function submitNomination(id: string, input: TSubmitNomination) {
    return requestApi(apiPath`/sessions/${id}/nominations`, { method: 'POST', json: input });
}
export async function closeNominations(id: string, input: TCloseNomination) {
    return requestApi(apiPath`/sessions/${id}/nominations/close`, { method: 'POST', json: input });
}
