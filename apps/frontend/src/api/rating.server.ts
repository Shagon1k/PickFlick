import 'server-only';

import type { TCloseRating, TSubmitRating } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const submitRating = (id: string, input: TSubmitRating) =>
    requestApi(apiPath`/sessions/${id}/rating`, { method: 'POST', json: input });

export const closeRating = (id: string, input: TCloseRating) =>
    requestApi(apiPath`/sessions/${id}/rating/close`, { method: 'POST', json: input });
