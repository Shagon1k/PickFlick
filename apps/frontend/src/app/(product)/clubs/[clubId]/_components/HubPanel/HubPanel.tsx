'use client';

import type { IClubHub } from '@pickflick/contracts';
import { createContext, type ReactNode, use, useEffect } from 'react';

/** Lets a panel hand its fresh Hub to the persistent Club frame. */
export const PublishHubContext = createContext<(hub: IClubHub | null) => void>(() => undefined);
/** The frame's latest Hub, read by loading boundaries to size their skeletons. */
export const HubSnapshotContext = createContext<IClubHub | null>(null);

/** Every panel publishes its fresh authorization result into the persistent Club frame. */
export default function HubPanel({ hub, children }: { hub: IClubHub | null; children: ReactNode }) {
    const publish = use(PublishHubContext);
    useEffect(() => publish(hub), [hub, publish]);
    return children;
}
