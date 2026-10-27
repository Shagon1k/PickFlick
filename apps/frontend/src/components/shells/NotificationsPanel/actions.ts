'use server';

import { HTTP_STATUS } from '@pickflick/contracts';

import { getNotifications, markNotificationsRead } from '#api/notifications.server';
import { getFailureMessage } from '#lib/action-failure';
import { ApiError } from '#lib/api.server';

export async function loadNotifications(cursor?: string) {
    try {
        return { ok: true as const, data: await getNotifications(cursor) };
    } catch (error) {
        return {
            ok: false as const,
            isUnauthorized: error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED,
            message: getFailureMessage(error, {
                request: 'Load notifications',
                statuses: [[[HTTP_STATUS.UNAUTHORIZED], 'Your session has ended. Sign in again.']],
                fallback: 'Notifications could not be loaded. Try again.',
            }),
        };
    }
}

export async function readNotifications(id?: string) {
    try {
        await markNotificationsRead(id);
        return { ok: true as const };
    } catch (error) {
        return {
            ok: false as const,
            isUnauthorized: error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED,
            message: getFailureMessage(error, {
                request: 'Read notifications',
                statuses: [[[HTTP_STATUS.UNAUTHORIZED], 'Your session has ended. Sign in again.']],
                fallback: 'Read state could not be saved. Try again.',
            }),
        };
    }
}
