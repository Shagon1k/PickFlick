'use client';

import type { TNotificationList } from '@pickflick/contracts';
import { createContext, use } from 'react';

interface INotificationsContext {
    data: TNotificationList | null;
    error: string;
    isLoading: boolean;
    isSaving: boolean;
    isLive: boolean;
    refresh: () => Promise<void>;
    markRead: (id?: string) => Promise<void>;
    loadMore: () => Promise<void>;
}

export const NotificationsContext = createContext<INotificationsContext | null>(null);

export function useNotifications() {
    const context = use(NotificationsContext);
    if (!context) throw new Error('NotificationsProvider is required.');
    return context;
}
