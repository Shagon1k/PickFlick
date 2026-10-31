'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true once React has attached event handlers.
 * Forms keep their controls disabled until then, so an early tap is never lost.
 */
export function useIsHydrated(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
}

/** The zone to format moments in: UTC while the server's markup hydrates, then the viewer's own. */
export function useViewerTimeZone(): string | undefined {
    return useIsHydrated() ? undefined : 'UTC';
}
