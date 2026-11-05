'use client';

import { useSearchParams } from 'next/navigation';

import LoadingState from '#components/ui/LoadingState/LoadingState';

import { getLibraryPanelVariant } from '../../library-tabs';

export default function LibraryPanelLoading() {
    const tab = useSearchParams().get('tab');
    return <LoadingState label="Loading your Library…" variant={getLibraryPanelVariant(tab)} />;
}
