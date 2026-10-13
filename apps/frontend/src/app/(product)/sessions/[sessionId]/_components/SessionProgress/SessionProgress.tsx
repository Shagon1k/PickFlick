'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState, useTransition } from 'react';

import { sessionProgressAction } from '../../progress-actions';

const POLL_MS = 5000;

/**
 * Polls the Session's progress version while the page is visible and reloads the server-rendered
 * projections when it grows. Losing access reloads once and stops polling.
 */
export default function SessionProgress({
    sessionId,
    version,
}: {
    sessionId: string;
    version: number | null;
}) {
    const router = useRouter();
    const [unavailable, setUnavailable] = useState(false);
    const [refreshing, startTransition] = useTransition();
    const onVersion = useEffectEvent((current: number) => {
        // A failed page load has no rendered version and must retry even an unchanged signal.
        if ((version === null || current > version) && !refreshing) {
            startTransition(() => router.refresh());
        }
    });
    const onDenied = useEffectEvent(() => router.refresh());
    useEffect(() => {
        let stopped = false;
        let polling = false;
        async function poll() {
            if (stopped || polling || document.visibilityState !== 'visible') return;
            polling = true;
            try {
                const result = await sessionProgressAction(sessionId);
                if (stopped) return;
                setUnavailable(result.state === 'unavailable');
                if (result.state === 'denied') {
                    stopped = true;
                    onDenied();
                } else if (result.state === 'ready') onVersion(result.version);
            } catch {
                if (!stopped) setUnavailable(true);
            } finally {
                polling = false;
            }
        }
        const refresh = () => {
            void poll();
        };
        const interval = window.setInterval(refresh, POLL_MS);
        window.addEventListener('online', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            stopped = true;
            window.clearInterval(interval);
            window.removeEventListener('online', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [sessionId]);
    return unavailable ? (
        <p role="status">Live updates unavailable. Progress refreshes periodically.</p>
    ) : null;
}
