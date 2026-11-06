import 'server-only';

import type { TCloseSelection, TSubmitSelection } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const submitSelection = (id: string, input: TSubmitSelection) =>
    requestApi(apiPath`/sessions/${id}/selection`, { method: 'POST', json: input });

export const closeSelection = (id: string, input: TCloseSelection) =>
    requestApi(apiPath`/sessions/${id}/selection/close`, { method: 'POST', json: input });
