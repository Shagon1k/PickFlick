import 'server-only';

import type { TSubmitSelection } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export async function submitSelection(id: string, input: TSubmitSelection) {
    return requestApi(apiPath`/sessions/${id}/selection`, { method: 'POST', json: input });
}
