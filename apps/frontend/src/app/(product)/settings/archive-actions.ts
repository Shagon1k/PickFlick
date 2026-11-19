'use server';

import {
    HTTP_STATUS,
    requestDataExportSchema,
    type TDataExportJob,
    type TDataExportLink,
} from '@pickflick/contracts';

import { createDataExportLink, getDataExport, requestDataExport } from '#api/data-exports.server';
import { getFailureMessage } from '#lib/action-failure';

type TResult<TData> = { ok: true; data: TData } | { ok: false; message: string };

function failure(error: unknown): { ok: false; message: string } {
    return {
        ok: false,
        message: getFailureMessage(error, {
            request: 'Personal data archive',
            reasons: {
                EXPORT_IN_PROGRESS:
                    'An archive is already being prepared. Return to the tab where you requested it, or try again after it finishes.',
            },
            statuses: [
                [
                    [HTTP_STATUS.UNAUTHORIZED],
                    'Your session has ended. Sign in again to manage your archive.',
                ],
                [
                    [HTTP_STATUS.NOT_FOUND],
                    'This archive is unavailable or has expired. Refresh its status or request another archive.',
                ],
                [
                    [HTTP_STATUS.TOO_MANY_REQUESTS],
                    'Too many archive requests. Try again in 10 minutes.',
                ],
            ],
            fallback: 'The archive request could not be completed. Try again.',
        }),
    };
}

export async function requestArchive(input: unknown): Promise<TResult<TDataExportJob>> {
    const parsed = requestDataExportSchema.safeParse(input);
    if (!parsed.success)
        return {
            ok: false,
            message: 'The archive request is invalid. Reload Settings and try again.',
        };
    try {
        return { ok: true, data: await requestDataExport(parsed.data) };
    } catch (error) {
        return failure(error);
    }
}

export async function readArchive(id: unknown): Promise<TResult<TDataExportJob>> {
    const parsed = requestDataExportSchema.shape.requestId.safeParse(id);
    if (!parsed.success)
        return {
            ok: false,
            message: 'This archive reference is invalid. Request another archive.',
        };
    try {
        return { ok: true, data: await getDataExport(parsed.data) };
    } catch (error) {
        return failure(error);
    }
}

export async function prepareArchiveDownload(id: unknown): Promise<TResult<TDataExportLink>> {
    const parsed = requestDataExportSchema.shape.requestId.safeParse(id);
    if (!parsed.success)
        return {
            ok: false,
            message: 'This archive reference is invalid. Request another archive.',
        };
    try {
        return { ok: true, data: await createDataExportLink(parsed.data) };
    } catch (error) {
        return failure(error);
    }
}
