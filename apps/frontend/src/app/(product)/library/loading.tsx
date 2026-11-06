import { Suspense } from 'react';

import ControlShell from '#components/shells/ControlShell/ControlShell';
import StatisticsSkeleton from '#components/statistics/StatisticsSkeleton/StatisticsSkeleton';
import LoadingState from '#components/ui/LoadingState/LoadingState';

import LibraryPanelLoading from './_components/LibraryPanelLoading/LibraryPanelLoading';
import LibraryPanelSkeleton from './_components/LibraryPanelLoading/LibraryPanelSkeleton';
import { getLibraryTabItems } from './library-tabs';

export default function LibraryLoading() {
    return (
        <ControlShell
            title="My Library"
            currentArea="library"
            clubItems={[]}
            summary={
                <LoadingState label="Loading personal statistics…">
                    <StatisticsSkeleton />
                </LoadingState>
            }
            items={getLibraryTabItems()}
        >
            <Suspense fallback={<LibraryPanelSkeleton />}>
                <LibraryPanelLoading />
            </Suspense>
        </ControlShell>
    );
}
