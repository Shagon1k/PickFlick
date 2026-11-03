import clsx from 'clsx';

import ticket from '#components/movies/film-ticket.module.scss';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './FilmRailSkeleton.module.scss';

export default function FilmRailSkeleton({
    scores = 0,
    actions = 0,
}: {
    scores?: number;
    actions?: number;
}) {
    return (
        <>
            {Array.from({ length: scores }, (_, index) => (
                <div className={clsx(ticket.railItem, styles.cell)} key={'score-' + index}>
                    <div className={styles.icon}>
                        <Skeleton variant="avatar" shouldFill />
                    </div>
                    <div className={styles.values}>
                        <div className={styles.value}>
                            <Skeleton shouldFill />
                        </div>
                        <div className={styles.label}>
                            <Skeleton shouldFill />
                        </div>
                    </div>
                </div>
            ))}
            {Array.from({ length: actions }, (_, index) => (
                <div className={ticket.railItem} key={'action-' + index}>
                    <div className={styles.icon}>
                        <Skeleton variant="avatar" shouldFill />
                    </div>
                    <div className={styles.actionLabel}>
                        <Skeleton shouldFill />
                    </div>
                </div>
            ))}
        </>
    );
}
