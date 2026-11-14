'use server';

import {
    HTTP_STATUS,
    RATINGS_CSV_MAX_BYTES,
    type TRatingsCsvExport,
    type TRatingsCsvResult,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { exportRatingsCsv, importRatingsCsv, previewRatingsCsv } from '#api/ratings-csv.server';
import { getFailureMessage } from '#lib/action-failure';

type TCsvResult<TData> = { ok: true; data: TData } | { ok: false; message: string };

function failure(error: unknown): { ok: false; message: string } {
    return {
        ok: false,
        message: getFailureMessage(error, {
            request: 'Transfer personal ratings',
            statuses: [
                [[HTTP_STATUS.UNAUTHORIZED], 'Your session has ended. Sign in again.'],
                [[HTTP_STATUS.PAYLOAD_TOO_LARGE], 'File exceeds 512 KiB. Split it and try again.'],
            ],
            fallback: 'Ratings could not be transferred. Try again. Repeating an import is safe.',
        }),
    };
}

export async function previewCsv(form: FormData): Promise<TCsvResult<TRatingsCsvResult>> {
    return upload(form, false);
}

export async function importCsv(form: FormData): Promise<TCsvResult<TRatingsCsvResult>> {
    return upload(form, true);
}

async function upload(
    form: FormData,
    shouldImport: boolean,
): Promise<TCsvResult<TRatingsCsvResult>> {
    const file = form.get('csv');
    if (!(file instanceof File) || !file.size || file.size > RATINGS_CSV_MAX_BYTES)
        return { ok: false, message: 'Choose a nonempty CSV file no larger than 512 KiB.' };
    try {
        const body = await file.arrayBuffer();
        const data = await (shouldImport ? importRatingsCsv(body) : previewRatingsCsv(body));
        if (data.imported) {
            revalidatePath('/library');
            revalidatePath('/movies/[movieId]', 'page');
        }
        return { ok: true, data };
    } catch (error) {
        return failure(error);
    }
}

export async function downloadCsv(): Promise<TCsvResult<TRatingsCsvExport>> {
    try {
        return { ok: true, data: await exportRatingsCsv() };
    } catch (error) {
        return failure(error);
    }
}
