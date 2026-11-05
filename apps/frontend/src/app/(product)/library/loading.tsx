import { Suspense } from 'react';

import ControlShell from '#components/shells/ControlShell/ControlShell';
import LoadingState from '#components/ui/LoadingState/LoadingState';

import LibraryPanelLoading from './_components/LibraryPanelLoading/LibraryPanelLoading';
import { getLibraryTabItems } from './library-tabs';

export default function LibraryLoading() {
    return (
        <ControlShell
            title="My Library"
            currentArea="library"
            clubItems={[]}
            summary={<LoadingState label="Loading personal statistics…" variant="statistics" />}
            items={getLibraryTabItems()}
        >
            <Suspense fallback={<LoadingState label="Loading your Library…" variant="ratings" />}>
                <LibraryPanelLoading />
            </Suspense>
        </ControlShell>
    );
}
