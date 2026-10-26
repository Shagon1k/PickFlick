import type { ReactNode } from 'react';

import { getLibraryStatistics } from '#api/library.server';
import ControlShell from '#components/shells/ControlShell/ControlShell';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';

import { loadLibraryRead } from '../../load-library-read';
import LibraryStatistics from '../LibraryStatistics/LibraryStatistics';

async function LibraryStatisticsSummary({ returnPath }: { returnPath: string }) {
    const statistics = await loadLibraryRead(getLibraryStatistics, returnPath);
    return statistics ? (
        <LibraryStatistics statistics={statistics} />
    ) : (
        <section aria-label="Personal statistics unavailable">
            <Alert tone="warning">Your statistics are temporarily unavailable.</Alert>
            <ButtonLink href={returnPath}>Retry statistics</ButtonLink>
        </section>
    );
}

export default function LibraryShell({
    current,
    returnPath,
    showStatistics,
    children,
}: {
    current: 'my-ratings' | 'watchlist' | 'achievements';
    returnPath: string;
    showStatistics: boolean;
    children: ReactNode;
}) {
    return (
        <ControlShell
            title="My Library"
            description="Your ratings and films to watch, at your own pace."
            currentArea="library"
            clubItems={[]}
            summary={showStatistics && <LibraryStatisticsSummary returnPath={returnPath} />}
            items={[
                {
                    label: 'My Ratings',
                    href: '/library?tab=my-ratings',
                    current: current === 'my-ratings',
                },
                {
                    label: 'Watchlist',
                    href: '/library?tab=watchlist',
                    current: current === 'watchlist',
                },
                {
                    label: 'Achievements',
                    href: '/library?tab=achievements',
                    current: current === 'achievements',
                },
            ]}
        >
            {children}
        </ControlShell>
    );
}
