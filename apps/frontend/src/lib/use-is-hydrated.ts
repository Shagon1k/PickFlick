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
