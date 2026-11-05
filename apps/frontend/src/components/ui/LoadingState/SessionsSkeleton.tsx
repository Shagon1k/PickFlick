import type { IClubHub, IClubHubSession } from '@pickflick/contracts';

import { formatHubSessionTitle } from '#components/sessions/club-session-text';
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
            {Array.from({ length: count }, (_, index) => (
                <SessionRow key={index} session={sessions?.[index]} isRating={isRating} />
            ))}
        </div>
    );
}

function getMeta(session: IClubHubSession | undefined, isRating: boolean) {
    if (!session) return null;
    const fields = [
        session.scheduledAt ? formatCalendarDate(session.scheduledAt) : 'Not scheduled',
        session.location,
    ];
    if (isRating)
        fields.push(
            session.acceptedCount
                ? `${session.progressCount ?? 0} of ${session.acceptedCount} rated`
                : 'No current participants',
        );
    return fields.filter(Boolean).join(' · ');
}
function SessionRow({ session, isRating }: { session?: IClubHubSession; isRating: boolean }) {
    const meta = getMeta(session, isRating);
    return (
        <div className={styles.row} data-rating={isRating || undefined}>
            <div className={styles.poster}>
                <Skeleton shouldFill />
            </div>
            <div className={styles.copy} data-known={Boolean(session) || undefined}>
                <div className={styles.name}>
                    {session ? (
                        <Skeleton text={formatHubSessionTitle(session)} />
                    ) : (
                        <Skeleton shouldFill />
                    )}
                </div>
                <div className={styles.meta}>{meta ? <Skeleton text={meta} /> : <Skeleton />}</div>
                {!isRating ? (
                    <div className={styles.meta}>
                        {session ? (
                            <Skeleton text={formatCount(session.acceptedCount, 'attendee')} />
                        ) : (
                            <Skeleton width="half" />
                        )}
                    </div>
                ) : null}
            </div>
            <RowResult session={session} isRating={isRating} />
        </div>
    );
}
function RowResult({ session, isRating }: { session?: IClubHubSession; isRating: boolean }) {
    if (isRating)
        return (
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
        );
    if (session?.phase === 'CANCELLED')
        return (
            <div className={styles.closedStatus}>
                <Skeleton text="Cancelled" />
            </div>
        );
    const average =
        session && session.ratingAverage !== null ? formatAverage(session.ratingAverage) : '—';
    return (
        <div className={styles.score} data-known={Boolean(session) || undefined}>
            {session ? <Skeleton text={average} /> : <Skeleton variant="title" shouldFill />}
        </div>
    );
}
