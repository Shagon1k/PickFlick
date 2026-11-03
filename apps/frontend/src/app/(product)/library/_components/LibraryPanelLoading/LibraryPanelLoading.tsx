'use client';

import { useSearchParams } from 'next/navigation';

import LoadingState from '#components/ui/LoadingState/LoadingState';

export default function LibraryPanelLoading() {
    const tab = useSearchParams().get('tab');
    return (
        <LoadingState
            label="Loading your Library…"
            variant={
                tab === 'achievements'
                    ? 'achievements'
                    : tab === 'watchlist'
                      ? 'watchlist'
                      : 'ratings'
            }
        />
    );
}
