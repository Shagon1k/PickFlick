import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './StatisticsSkeleton.module.scss';

const CLUB_STAT_COUNT = 7;
const PERSONAL_STAT_COUNT = 8;
const CLUB_SMALL_STAT_COUNT = 2;
const PERSONAL_SMALL_STAT_COUNT = 3;

/** The Club overview strip, or the personal statistics above My Library. */

export default function StatisticsSkeleton({ isOverview = false }: { isOverview?: boolean }) {
    const count = isOverview ? CLUB_STAT_COUNT : PERSONAL_STAT_COUNT;
    // The last few tiles hold text rather than a number.
    const firstTextIndex = count - (isOverview ? CLUB_SMALL_STAT_COUNT : PERSONAL_SMALL_STAT_COUNT);
    return (
        <div className={styles.statistics} data-overview={isOverview || undefined}>
            {Array.from({ length: count }, (_, index) => {
                const isText = index >= firstTextIndex;
                return (
                    <div className={styles.stat} key={index}>
                        <div className={styles.statIcon}>
                            <Skeleton variant="avatar" shouldFill />
                        </div>
                        <div className={styles.statCopy}>
                            <div className={styles.statValue} data-text={isText || undefined}>
                                <Skeleton variant={isText ? 'text' : 'title'} />
                            </div>
                            <div className={styles.statLabel}>
                                <Skeleton />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
