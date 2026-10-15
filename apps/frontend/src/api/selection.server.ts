import 'server-only';

import type { TCloseSelection, TSubmitSelection } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export async function submitSelection(id: string, input: TSubmitSelection) {
    return requestApi(apiPath`/sessions/${id}/selection`, { method: 'POST', json: input });
}

export async function closeSelection(id: string, input: TCloseSelection) {
    return requestApi(apiPath`/sessions/${id}/selection/close`, { method: 'POST', json: input });
}
