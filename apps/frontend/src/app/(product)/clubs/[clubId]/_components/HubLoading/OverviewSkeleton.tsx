import type { IClubHub } from '@pickflick/contracts';

import { formatSessionPhase, formatSessionProgress } from '#components/sessions/club-session-text';
import StatisticsSkeleton from '#components/statistics/StatisticsSkeleton/StatisticsSkeleton';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';

import styles from './OverviewSkeleton.module.scss';

const ROW_COUNT = 4;

export default function OverviewSkeleton({ hub }: { hub?: IClubHub | null }) {
    return (
        <div className={styles.overview}>
            <StatisticsSkeleton isOverview />
            <div className={styles.cards}>
                <section className={styles.card}>
                    <div className={styles.cardHeading}>
                        <Skeleton variant="title" width="half" />
                    </div>
                    <div className={styles.pills}>
                        {Array.from({ length: ROW_COUNT }, (_, index) => (
                            <div className={styles.pill} key={index}>
                                <div className={styles.pillAvatar}>
                                    <Skeleton variant="avatar" shouldFill />
                                </div>
                                <Skeleton />
                            </div>
                        ))}
                    </div>
                </section>
                <section className={styles.card}>
                    <div className={styles.cardHeading}>
                        <Skeleton variant="title" width="half" />
                    </div>
                    <div className={styles.active}>
                        <p className={styles.activeLine}>
                            <Skeleton
                                text={
                                    hub?.activeSession
                                        ? `Current phase: ${formatSessionPhase(hub.activeSession.phase)} — ${formatSessionProgress(hub.activeSession, hub.memberCount)}`
                                        : 'No active Session.'
                                }
                            />
                        </p>
                        {hub?.activeSession ? (
                            <>
                                <div className={styles.progress}>
                                    <Skeleton shouldFill />
                                </div>
                                <div className={styles.activeAction}>
                                    <Skeleton shouldFill />
                                </div>
                            </>
                        ) : null}
                        {!hub?.activeSession && hub?.permissions.manageSessions ? (
                            <div className={styles.emptyActions}>
                                <div className={styles.activeAction}>
                                    <Skeleton shouldFill />
                                </div>
                                <div className={styles.activeAction}>
                                    <Skeleton shouldFill />
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>
            <SprocketDivider variant="section" />
            <section className={styles.card}>
                <div className={styles.cardHeading}>
                    <Skeleton variant="title" width="short" />
                </div>
                <div className={styles.activity}>
                    {Array.from({ length: ROW_COUNT }, (_, index) => (
                        <div key={index}>
                            <Skeleton width="half" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
