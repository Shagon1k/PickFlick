import 'server-only';

import { type TCloseNomination, type TSubmitNomination } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const submitNomination = (id: string, input: TSubmitNomination) =>
    requestApi(apiPath`/sessions/${id}/nominations`, { method: 'POST', json: input });
export const closeNominations = (id: string, input: TCloseNomination) =>
    requestApi(apiPath`/sessions/${id}/nominations/close`, { method: 'POST', json: input });
