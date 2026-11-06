import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './MembersSkeleton.module.scss';

const ROW_COUNT = 4;

export default function MembersSkeleton({ withRemovals = false }: { withRemovals?: boolean }) {
    return (
        <div>
            {Array.from({ length: ROW_COUNT }, (_, index) => (
                <div className={styles.member} key={index}>
                    <div className={styles.identity}>
                        <Skeleton variant="avatar" />
                        <div className={styles.identityCopy}>
                            <div className={styles.memberName}>
                                <Skeleton shouldFill />
                            </div>
                            <div className={styles.memberRole}>
                                <Skeleton shouldFill />
                            </div>
                        </div>
                    </div>
                    <div className={styles.memberActions}>
                        <div className={styles.sessionCount}>
                            <div>
                                <Skeleton shouldFill />
                            </div>
                            <Skeleton />
                        </div>
                        {withRemovals ? (
                            <div className={styles.remove}>
                                <Skeleton variant="control" />
                            </div>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}
