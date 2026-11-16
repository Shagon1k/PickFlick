'use server';

import { deleteAccountSchema, HTTP_STATUS } from '@pickflick/contracts';

import { acceptAccountDeletion, startAccountDeletion } from '#api/account.server';
import { getFailureMessage } from '#lib/action-failure';

type TResult = { ok: true } | { ok: false; message: string };

function failure(error: unknown): TResult {
    return {
        ok: false,
        message: getFailureMessage(error, {
            request: 'Delete account',
            statuses: [
                [
                    [HTTP_STATUS.UNAUTHORIZED],
                    'Your session has ended. Sign in again to check your account.',
                ],
                [
                    [HTTP_STATUS.CONFLICT],
                    'Sign in again to the same account before confirming deletion.',
                ],
            ],
            fallback:
                'Deletion could not be confirmed. Try again or sign in to check your account.',
        }),
    };
}

export async function prepareAccountDeletion(): Promise<TResult> {
    try {
        await startAccountDeletion();
        return { ok: true };
    } catch (error) {
        return failure(error);
    }
}

export async function deleteAccount(input: unknown): Promise<TResult> {
    const parsed = deleteAccountSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Type DELETE to confirm.' };
    try {
        await acceptAccountDeletion(parsed.data);
        return { ok: true };
    } catch (error) {
        return failure(error);
    }
}
