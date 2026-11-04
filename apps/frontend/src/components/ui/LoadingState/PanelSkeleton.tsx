import type { IClubHub } from '@pickflick/contracts';

import { formatSessionPhase, formatSessionProgress } from '#components/sessions/club-session-text';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';

import styles from './PanelSkeleton.module.scss';
import SessionsSkeleton from './SessionsSkeleton';
import SettingsSkeleton from './SettingsSkeleton';
import TableSkeleton from './TableSkeleton';

export type TPanelSkeletonVariant =
    | 'overview'
    | 'sessions'
    | 'club-ratings'
    | 'ratings'
    | 'watchlist'
    | 'members'
    | 'achievements'
    | 'settings'
    | 'statistics';
const ROW_COUNT = 4;
const ACHIEVEMENT_COUNT = 3;
const CLUB_STAT_COUNT = 7;
const PERSONAL_STAT_COUNT = 8;
const CLUB_SMALL_STAT_COUNT = 2;
const PERSONAL_SMALL_STAT_COUNT = 3;

export default function PanelSkeleton({
    variant,
    hub,
}: {
    variant: TPanelSkeletonVariant;
    hub?: IClubHub | null;
}) {
    if (variant === 'sessions') return <SessionsSkeleton hub={hub} />;
    if (variant === 'settings') return <SettingsSkeleton hub={hub} />;
    if (variant === 'ratings' || variant === 'club-ratings' || variant === 'watchlist')
        return <TableSkeleton variant={variant} />;
    if (variant === 'members')
        return <Members withRemovals={hub?.members.some((member) => member.canRemove)} />;
    if (variant === 'statistics')
        return (
            <div className={styles.libraryStats}>
                <Statistics />
            </div>
        );
    if (variant === 'achievements') return <Achievements />;
    return (
        <div className={styles.overview}>
            <Statistics isOverview />
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
                            <div className={styles.progress}>
                                <Skeleton shouldFill />
                            </div>
                        ) : null}
                        {hub?.activeSession ? (
                            <div className={styles.activeAction}>
                                <Skeleton shouldFill />
                            </div>
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

function Statistics({ isOverview = false }: { isOverview?: boolean }) {
    const count = isOverview ? CLUB_STAT_COUNT : PERSONAL_STAT_COUNT;
    return (
        <div className={styles.statistics} data-overview={isOverview || undefined}>
            {Array.from({ length: count }, (_, index) => {
                const isText =
                    index >=
                    (isOverview
                        ? CLUB_STAT_COUNT - CLUB_SMALL_STAT_COUNT
                        : PERSONAL_STAT_COUNT - PERSONAL_SMALL_STAT_COUNT);
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

function Members({ withRemovals = false }: { withRemovals?: boolean }) {
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

function Achievements() {
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
