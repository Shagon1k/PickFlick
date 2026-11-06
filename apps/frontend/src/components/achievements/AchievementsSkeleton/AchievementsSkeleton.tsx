import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './AchievementsSkeleton.module.scss';

const ROW_COUNT = 4;
const ACHIEVEMENT_COUNT = 3;

export default function AchievementsSkeleton() {
    return (
        <div className={styles.achievementLayout}>
            <div className={styles.filters}>
                {Array.from({ length: ROW_COUNT }, (_, index) => (
                    <div className={styles.filter} key={index}>
                        <div className={styles.filterValue}>
                            <Skeleton variant="title" />
                        </div>
                        <div className={styles.filterLabel}>
                            <Skeleton />
                        </div>
                    </div>
                ))}
            </div>
            <div className={styles.shelf}>
                {Array.from({ length: ACHIEVEMENT_COUNT }, (_, index) => (
                    <article className={styles.achievement} key={index}>
                        <div className={styles.badge}>
                            <Skeleton variant="avatar" shouldFill />
                        </div>
                        <div className={styles.achievementStatus}>
                            <Skeleton shouldFill />
                        </div>
                        <div className={styles.achievementTitle}>
                            <Skeleton />
                        </div>
                        <div className={styles.description}>
                            <Skeleton />
                            <Skeleton />
                            <Skeleton width="half" />
                        </div>
                        <div className={styles.achievementProgress}>
                            <div>
                                <Skeleton />
                            </div>
                            <div className={styles.bar}>
                                <Skeleton shouldFill />
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}
