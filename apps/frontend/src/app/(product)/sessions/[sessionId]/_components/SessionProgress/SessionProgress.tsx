'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState, useTransition } from 'react';

import { watchSessionProgress } from '@/api/session-progress';

import { sessionProgressAction } from '../../progress-actions';

export default function SessionProgress({
    sessionId,
    version,
}: {
    sessionId: string;
    version: number;
}) {
    const router = useRouter();
    const [unavailable, setUnavailable] = useState(false);
    const [refreshing, startTransition] = useTransition();
    const onVersion = useEffectEvent((current: number) => {
        // Compare with the rendered projection, including signals skipped during a reconnect.
        if (current > version && !refreshing && navigator.onLine) {
            startTransition(() => router.refresh());
        }
    });
    useEffect(() => {
        let connected = false;
        let stopped = false;
        let polling = false;
        function denied() {
            stopped = true;
            close();
            router.refresh();
        }
        const close = watchSessionProgress(sessionId, {
            progress: onVersion,
            connected: (value) => {
                connected = value;
                setUnavailable(!value);
            },
            denied,
        });
        async function poll() {
            if (stopped || polling || !navigator.onLine) return;
            polling = true;
            try {
                const result = await sessionProgressAction(sessionId);
                if (stopped) return;
                if (result.state === 'denied') denied();
                else if (result.state === 'ready') onVersion(result.version);
                else setUnavailable(true);
            } catch {
                if (!stopped) setUnavailable(true);
            } finally {
                polling = false;
            }
        }
        const refresh = () => {
            void poll();
        };
        const interval = window.setInterval(() => {
            if (!connected) refresh();
        }, 15000);
        window.addEventListener('online', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            stopped = true;
            close();
            window.clearInterval(interval);
            window.removeEventListener('online', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [sessionId, router]);
    return unavailable ? (
        <p role="status">Live updates unavailable. Progress refreshes periodically.</p>
    ) : null;
}
