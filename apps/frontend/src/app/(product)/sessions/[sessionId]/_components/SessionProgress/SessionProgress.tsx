'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState, useTransition } from 'react';

import { sessionProgressAction } from '../../progress-actions';

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
    useEffect(() => {
        let stopped = false;
        let polling = false;
        function denied() {
            stopped = true;
            router.refresh();
        }
        async function poll() {
            if (stopped || polling) return;
            polling = true;
            try {
                const result = await sessionProgressAction(sessionId);
                if (stopped) return;
                if (result.state === 'denied') denied();
                else if (result.state === 'ready') {
                    setUnavailable(false);
                    onVersion(result.version);
                } else setUnavailable(true);
            } catch {
                if (!stopped) setUnavailable(true);
            } finally {
                polling = false;
            }
        }
        const refresh = () => {
            void poll();
        };
        refresh();
        const interval = window.setInterval(refresh, 5000);
        window.addEventListener('online', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            stopped = true;
            window.clearInterval(interval);
            window.removeEventListener('online', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [sessionId, router]);
    return unavailable ? (
        <p role="status">Progress updates unavailable. Reconnect or refresh to try again.</p>
    ) : null;
}
