'use client';

import type { IClubHub } from '@pickflick/contracts';
import { createContext, type ReactNode, use, useEffect } from 'react';

export const HubSnapshotContext = createContext<(hub: IClubHub | null) => void>(() => undefined);

/** Every panel publishes its fresh authorization result into the persistent Club frame. */
export default function HubPanel({ hub, children }: { hub: IClubHub | null; children: ReactNode }) {
    const publish = use(HubSnapshotContext);
    useEffect(() => publish(hub), [hub, publish]);
    return children;
}
