'use client';

import { use } from 'react';

import LoadingState from '#components/ui/LoadingState/LoadingState';
import type { TPanelSkeletonVariant } from '#components/ui/LoadingState/PanelSkeleton';

import { HubSnapshotContext } from '../HubPanel/HubPanel';

export default function HubLoading({
    variant,
    label,
}: {
    variant: TPanelSkeletonVariant;
    label: string;
}) {
    const hub = use(HubSnapshotContext);
    return <LoadingState variant={variant} label={label} hub={hub} />;
}
