import 'server-only';

import type { TCloseRating, TSubmitRating } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export async function submitRating(id: string, input: TSubmitRating) {
    return requestApi(apiPath`/sessions/${id}/rating`, { method: 'POST', json: input });
}

export async function closeRating(id: string, input: TCloseRating) {
    return requestApi(apiPath`/sessions/${id}/rating/close`, { method: 'POST', json: input });
}
