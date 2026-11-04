'use client';

import { useSearchParams } from 'next/navigation';

import LoadingState from '#components/ui/LoadingState/LoadingState';

export default function LibraryPanelLoading() {
    const tab = useSearchParams().get('tab');
    const tableVariant = tab === 'watchlist' ? 'watchlist' : 'ratings';
    return (
        <LoadingState
            label="Loading your Library…"
            variant={tab === 'achievements' ? 'achievements' : tableVariant}
        />
    );
}
