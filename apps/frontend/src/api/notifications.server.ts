import 'server-only';

import type { TNotificationList } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const getNotifications = (cursor?: string): Promise<TNotificationList> => {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return requestApi(`/notifications${query}`);
};

export const markNotificationsRead = (id?: string): Promise<void> =>
    requestApi(id ? apiPath`/notifications/${id}/read` : '/notifications/read', {
        method: 'POST',
        json: {},
    });
