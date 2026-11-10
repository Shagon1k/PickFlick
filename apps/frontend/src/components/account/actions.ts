'use server';

import {
    ACCOUNT_AVATAR_MAX_BYTES,
    appearanceSchema,
    HTTP_STATUS,
    type IAccountProfile,
    updateProfileSchema,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import {
    getAccount,
    removeAccountAvatar,
    replaceAccountAvatar,
    updateAccountAppearance,
    updateAccountProfile,
} from '#api/account.server';
import { getFailureMessage } from '#lib/action-failure';

type TAccountResult = { ok: true; data: IAccountProfile } | { ok: false; message: string };

function failure(error: unknown): TAccountResult {
    return {
        ok: false,
        message: getFailureMessage(error, {
            request: 'Save account settings',
            statuses: [
                [[HTTP_STATUS.UNAUTHORIZED], 'Your session has ended. Sign in again.'],
                [
                    [HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.PAYLOAD_TOO_LARGE],
                    'Choose a valid PNG, JPEG or WebP image no larger than 512 KiB.',
                ],
            ],
            fallback: 'Your changes could not be saved. Try again.',
        }),
    };
}

export async function saveAppearance(input: unknown): Promise<TAccountResult> {
    const parsed = appearanceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Review your appearance settings.' };
    try {
        const data = await updateAccountAppearance(parsed.data);
        revalidatePath('/', 'layout');
        return { ok: true, data };
    } catch (error) {
        return failure(error);
    }
}

export async function saveProfile(input: unknown): Promise<TAccountResult> {
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success)
        return { ok: false, message: 'Enter a display name between 1 and 80 characters.' };
    try {
        const data = await updateAccountProfile(parsed.data);
        revalidatePath('/', 'layout');
        return { ok: true, data };
    } catch (error) {
        return failure(error);
    }
}

export async function saveAvatar(form: FormData): Promise<TAccountResult> {
    const file = form.get('avatar');
    if (
        !(file instanceof File) ||
        !file.size ||
        file.size > ACCOUNT_AVATAR_MAX_BYTES ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    )
        return { ok: false, message: 'Choose a PNG, JPEG or WebP image no larger than 512 KiB.' };
    try {
        await replaceAccountAvatar(await file.arrayBuffer(), file.type);
        revalidatePath('/', 'layout');
        return { ok: true, data: await getAccount() };
    } catch (error) {
        return failure(error);
    }
}

export async function deleteAvatar(): Promise<TAccountResult> {
    try {
        await removeAccountAvatar();
        revalidatePath('/', 'layout');
        return { ok: true, data: await getAccount() };
    } catch (error) {
        return failure(error);
    }
}
