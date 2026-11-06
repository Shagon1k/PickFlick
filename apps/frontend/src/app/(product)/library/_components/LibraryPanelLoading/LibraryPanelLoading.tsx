'use client';

import { useSearchParams } from 'next/navigation';

import LibraryPanelSkeleton from './LibraryPanelSkeleton';

export default function LibraryPanelLoading() {
    return <LibraryPanelSkeleton tab={useSearchParams().get('tab')} />;
}
