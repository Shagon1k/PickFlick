import type { IClubHub, IClubHubSession } from '@pickflick/contracts';

import Skeleton from '#components/ui/Skeleton/Skeleton';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { formatAverage, formatCalendarDate, formatCount } from '#lib/format';

import styles from './SessionsSkeleton.module.scss';

const ROW_COUNT = 4;
const AVATAR_COUNT = 3;

export default function SessionsSkeleton({ hub }: { hub?: IClubHub | null }) {
    return (
        <div className={styles.sessions}>
            {hub?.ratingSessions.length ? (
                <>
                    <section>
                        <Heading />
                        <Rows
                            count={Math.min(ROW_COUNT, hub.ratingSessions.length)}
                            sessions={hub.ratingSessions}
                            isRating
                        />
                    </section>
                    <SprocketDivider variant="section" />
                </>
            ) : null}
            <section>
                <Heading withAction={hub?.permissions.manageSessions} />
                <Rows
                    count={hub ? Math.min(ROW_COUNT, hub.historySessions.length) : ROW_COUNT}
                    sessions={hub?.historySessions}
                />
            </section>
        </div>
    );
}

function Heading({ withAction = false }: { withAction?: boolean }) {
    return (
        <div className={styles.heading}>
            <div className={styles.title}>
                <Skeleton shouldFill />
            </div>
            <div className={styles.headingActions}>
                <div className={styles.count}>
                    <Skeleton />
                </div>
                {withAction ? (
                    <div className={styles.action}>
                        <Skeleton variant="control" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function Rows({
    count,
    isRating = false,
    sessions,
}: {
    count: number;
    isRating?: boolean;
    sessions?: IClubHubSession[];
}) {
    if (!count) return <Skeleton width="half" />;
    return (
        <div>
            {Array.from({ length: count }, (_, index) => {
                const session = sessions?.[index];
                const meta = session
                    ? [
                          session.scheduledAt
                              ? formatCalendarDate(session.scheduledAt)
                              : 'Not scheduled',
                          session.location,
                          ...(isRating
                              ? [
                                    session.acceptedCount
                                        ? `${session.progressCount ?? 0} of ${session.acceptedCount} rated`
                                        : 'No current participants',
                                ]
                              : []),
                      ]
                          .filter(Boolean)
                          .join(' · ')
                    : null;
                return (
                    <div className={styles.row} data-rating={isRating || undefined} key={index}>
                        <div className={styles.poster}>
                            <Skeleton variant="poster" shouldFill />
                        </div>
                        <div className={styles.copy} data-known={Boolean(session) || undefined}>
                            <div className={styles.name}>
                                {session ? (
                                    <Skeleton
                                        text={
                                            session.movie?.title ??
                                            session.topic ??
                                            'Untitled Session'
                                        }
                                    />
                                ) : (
                                    <Skeleton shouldFill />
                                )}
                            </div>
                            <div className={styles.meta}>
                                {meta ? <Skeleton text={meta} /> : <Skeleton />}
                            </div>
                            {!isRating ? (
                                <div className={styles.meta}>
                                    {session ? (
                                        <Skeleton
                                            text={formatCount(session.acceptedCount, 'attendee')}
                                        />
                                    ) : (
                                        <Skeleton width="half" />
                                    )}
                                </div>
                            ) : null}
                        </div>
                        {isRating ? (
                            <>
                                <div className={styles.participants}>
                                    {Array.from({ length: AVATAR_COUNT }, (_, avatar) => (
                                        <div key={avatar}>
                                            <Skeleton variant="avatar" shouldFill />
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.progress}>
                                    <div>
                                        <Skeleton shouldFill />
                                    </div>
                                </div>
                            </>
                        ) : session?.phase === 'CANCELLED' ? (
                            <div className={styles.closedStatus}>
                                <Skeleton text="Cancelled" />
                            </div>
                        ) : (
                            <div
                                className={styles.score}
                                data-known={Boolean(session) || undefined}
                            >
                                {session ? (
                                    <Skeleton
                                        text={
                                            session.ratingAverage === null
                                                ? '—'
                                                : formatAverage(session.ratingAverage)
                                        }
                                    />
                                ) : (
                                    <Skeleton variant="title" shouldFill />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
