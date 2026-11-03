import { Suspense } from 'react';

import ControlShell from '#components/shells/ControlShell/ControlShell';
import LoadingState from '#components/ui/LoadingState/LoadingState';

import LibraryPanelLoading from './_components/LibraryPanelLoading/LibraryPanelLoading';

export default function LibraryLoading() {
    return (
        <ControlShell
            title="My Library"
            currentArea="library"
            clubItems={[]}
            summary={<LoadingState label="Loading personal statistics…" variant="statistics" />}
            items={[
                { label: 'My Ratings', icon: 'ratings', href: '/library?tab=my-ratings' },
                { label: 'Watchlist', icon: 'watchlist', href: '/library?tab=watchlist' },
                { label: 'Achievements', icon: 'achievements', href: '/library?tab=achievements' },
            ]}
        >
            <Suspense fallback={<LoadingState label="Loading your Library…" variant="ratings" />}>
                <LibraryPanelLoading />
            </Suspense>
        </ControlShell>
    );
}
