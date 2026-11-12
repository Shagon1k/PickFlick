import 'server-only';

import type { TRatingsCsvExport, TRatingsCsvResult } from '@pickflick/contracts';

import { requestApi } from '#lib/api.server';

export const previewRatingsCsv = (body: ArrayBuffer) =>
    requestApi<TRatingsCsvResult>('/library/ratings-csv/preview', {
        method: 'POST',
        body,
        contentType: 'text/csv',
    });
export const importRatingsCsv = (body: ArrayBuffer) =>
    requestApi<TRatingsCsvResult>('/library/ratings-csv/import', {
        method: 'POST',
        body,
        contentType: 'text/csv',
    });
export const exportRatingsCsv = () => requestApi<TRatingsCsvExport>('/library/ratings-csv');
