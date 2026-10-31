'use server';

import { HTTP_STATUS } from '@pickflick/contracts';

import { getNotifications, markNotificationsRead } from '#api/notifications.server';
import { getFailureMessage } from '#lib/action-failure';
import { ApiError } from '#lib/api.server';

/** A failed notification request as the provider shows it; a lost session also clears the list. */
function toNotificationFailure(error: unknown, request: string, fallback: string) {
    return {
        ok: false as const,
        isUnauthorized: error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED,
        message: getFailureMessage(error, {
            request,
            statuses: [[[HTTP_STATUS.UNAUTHORIZED], 'Your session has ended. Sign in again.']],
            fallback,
        }),
    };
}

export async function loadNotifications(cursor?: string) {
    try {
        return { ok: true as const, data: await getNotifications(cursor) };
    } catch (error) {
        return toNotificationFailure(
            error,
            'Load notifications',
            'Notifications could not be loaded. Try again.',
        );
    }
}

export async function readNotifications(id?: string) {
    try {
        await markNotificationsRead(id);
        return { ok: true as const };
    } catch (error) {
        return toNotificationFailure(
            error,
            'Read notifications',
            'Read state could not be saved. Try again.',
        );
    }
}
