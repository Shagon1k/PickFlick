import { type ReactNode, Suspense } from 'react';

import { getLibraryStatistics } from '#api/library.server';
import ControlShell from '#components/shells/ControlShell/ControlShell';
import StatisticsSkeleton from '#components/statistics/StatisticsSkeleton/StatisticsSkeleton';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';
import LoadingState from '#components/ui/LoadingState/LoadingState';

import { getLibraryTabItems } from '../../library-tabs';
import { loadLibraryRead } from '../../load-library-read';
import styles from '../../page.module.scss';
import LibraryStatistics from '../LibraryStatistics/LibraryStatistics';

async function LibraryStatisticsSummary({ returnPath }: { returnPath: string }) {
    const statistics = await loadLibraryRead(getLibraryStatistics, returnPath);
    return statistics ? (
        <LibraryStatistics statistics={statistics} />
    ) : (
        <section className={styles.recovery} aria-label="Personal statistics unavailable">
            <Alert tone="warning">Your statistics are temporarily unavailable.</Alert>
            <ButtonLink href={returnPath}>Retry statistics</ButtonLink>
        </section>
    );
}

export default function LibraryShell({
    current,
    returnPath,
    shouldShowStatistics,
    children,
}: {
    current: 'my-ratings' | 'watchlist' | 'achievements';
    returnPath: string;
    shouldShowStatistics: boolean;
    children: ReactNode;
}) {
    return (
        <ControlShell
            title="My Library"
            currentArea="library"
            clubItems={[]}
            summary={
                shouldShowStatistics && (
                    <Suspense
                        fallback={
                            <LoadingState label="Loading personal statistics…">
                                <StatisticsSkeleton />
                            </LoadingState>
                        }
                    >
                        <LibraryStatisticsSummary returnPath={returnPath} />
                    </Suspense>
                )
            }
            items={getLibraryTabItems(current)}
        >
            {children}
        </ControlShell>
    );
}
