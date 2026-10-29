'use client';

import type { TNotificationList } from '@pickflick/contracts';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { NotificationsContext } from '#components/notifications/notifications-context';
import {
    loadNotifications,
    readNotifications,
} from '#components/notifications/NotificationsPanel/actions';
import { getOfflineMessage } from '#lib/offline';

const RECONCILE_MS = 5 * 60_000;

async function loadPages(pageCount: number) {
    const first = await loadNotifications();
    if (!first.ok) return first;
    const next = first.data;
    for (let index = 1; index < pageCount && next.nextCursor; index++) {
        const page = await loadNotifications(next.nextCursor);
        if (!page.ok) return page;
        next.items.push(...page.data.items);
        next.nextCursor = page.data.nextCursor;
    }
    return first;
}

export default function NotificationsProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<TNotificationList | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const pageCountRef = useRef(1);
    const requestVersionRef = useRef(0);
    const inFlightRef = useRef<Promise<void> | null>(null);

    const pendingSignalRef = useRef(false);

    const refresh = useCallback((): Promise<void> => {
        if (inFlightRef.current) return inFlightRef.current;
        const offline = getOfflineMessage();
        if (offline) {
            setError(offline);
            setIsLoading(false);
            return Promise.resolve();
        }
        const version = ++requestVersionRef.current;
        const perform = async () => {
            do {
                pendingSignalRef.current = false;
                const first = await loadPages(pageCountRef.current);
                if (!first.ok) {
                    if (version === requestVersionRef.current) {
                        if (first.isUnauthorized) setData(null);
                        setError(first.message);
                        setIsLoading(false);
                    }
                    return;
                }
                if (version === requestVersionRef.current) {
                    setData(first.data);
                    setError('');
                    setIsLoading(false);
                }
            } while (pendingSignalRef.current);
        };
        const result = perform()
            .catch(() => {
                if (version !== requestVersionRef.current) return;
                console.error('Notification refresh request failed.');
                setError('Notifications could not be loaded. Try again.');
                setIsLoading(false);
            })
            .finally(() => {
                inFlightRef.current = null;
            });
        inFlightRef.current = result;
        return result;
    }, []);

    useEffect(() => {
        const stream = new EventSource('/api/notifications/stream');
        stream.onopen = () => {
            setIsLive(true);
            void refresh();
        };
        stream.onmessage = () => {
            if (inFlightRef.current) pendingSignalRef.current = true;
            void refresh();
        };
        stream.onerror = () => {
            setIsLive(false);
        };
        const timer = setInterval(() => {
            void refresh();
        }, RECONCILE_MS);
        const handleReconnect = () => {
            void refresh();
        };
        window.addEventListener('online', handleReconnect);
        window.addEventListener('focus', handleReconnect);
        const initial = setTimeout(() => {
            void refresh();
        }, 0);
        const invalidate = () => {
            requestVersionRef.current++;
        };
        return () => {
            stream.close();
            pendingSignalRef.current = false;
            clearInterval(timer);
            window.removeEventListener('online', handleReconnect);
            window.removeEventListener('focus', handleReconnect);
            clearTimeout(initial);
            invalidate();
        };
    }, [refresh]);

    const markRead = async (id?: string) => {
        const offline = getOfflineMessage();
        if (offline) {
            setError(offline);
            return;
        }
        setIsSaving(true);
        requestVersionRef.current++;
        try {
            const result = await readNotifications(id);
            if (result.ok) {
                await inFlightRef.current;
                await refresh();
            } else {
                if (result.isUnauthorized) setData(null);
                setError(result.message);
            }
        } catch {
            console.error('Read notifications request failed.');
            setError('Read state could not be saved. Try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const loadMore = async () => {
        pageCountRef.current++;
        setIsLoading(true);
        await inFlightRef.current;
        await refresh();
    };

    return (
        <NotificationsContext
            value={{
                data,
                error,
                isLoading,
                isSaving,
                isLive,
                refresh,
                markRead,
                loadMore,
            }}
        >
            {children}
        </NotificationsContext>
    );
}
