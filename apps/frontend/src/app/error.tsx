'use client';

import { useEffect } from 'react';

import SystemState from '@/components/shells/SystemState/SystemState';
import { authClient } from '@/lib/auth-client';

export default function ApplicationError({
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    // Until the session resolves, the public recovery chrome stays safe even when the API is down.
    const { data: session } = authClient.useSession();
    const signedIn = Boolean(session?.user);

    useEffect(() => {
        globalThis.document.getElementById('system-state-title')?.focus({ preventScroll: true });
    }, [signedIn]);

    return <SystemState onRetry={retry} signedIn={signedIn} variant="application-error" />;
}
