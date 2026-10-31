'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useNotifications } from '#components/notifications/notifications-context';

/**
 * Reloads the Hub's server snapshot when another member changes the Club. A new notification is
 * the live signal; returning to the tab catches changes whose events this viewer muted.
 */
export default function HubLiveRefresh() {
    const router = useRouter();
    const latestId = useNotifications().data?.items[0]?.id;
    const seenIdRef = useRef(latestId);
    useEffect(() => {
        if (latestId === seenIdRef.current) return;
        const isFirstLoad = seenIdRef.current === undefined;
        seenIdRef.current = latestId;
        if (!isFirstLoad) router.refresh();
    }, [latestId, router]);
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === 'visible') router.refresh();
        };
        document.addEventListener('visibilitychange', refresh);
        return () => document.removeEventListener('visibilitychange', refresh);
    }, [router]);
    return null;
}
