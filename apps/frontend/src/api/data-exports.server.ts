import 'server-only';

import type { TDataExportJob, TDataExportLink, TRequestDataExport } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const requestDataExport = (input: TRequestDataExport) =>
    requestApi<TDataExportJob>('/account/data-exports', { method: 'POST', json: input });
export const getDataExport = (id: string) =>
    requestApi<TDataExportJob>(apiPath`/account/data-exports/${id}`);
export const createDataExportLink = (id: string) =>
    requestApi<TDataExportLink>(apiPath`/account/data-exports/${id}/download-link`, {
        method: 'POST',
        json: {},
    });
