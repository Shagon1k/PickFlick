'use client';

import type { IClubHubSession } from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { formatHubSessionTitle } from '#components/sessions/club-session-text';
import RatingClose from '#components/sessions/RatingClose/RatingClose';
import Button from '#components/ui/Button/Button';
import { formatCalendarDate } from '#lib/format';

import styles from './ActiveRatings.module.scss';
import type { TRatingCloseControl } from './ActiveRatings.types';

/** Rating Sessions still collecting responses; they never block the Club's next Session. */
export default function ActiveRatings({
    sessions,
    controls,
}: {
    sessions: IClubHubSession[];
    controls: TRatingCloseControl[];
}) {
    const router = useRouter();
    const [isRefreshing, startTransition] = useTransition();
    return (
        <section aria-labelledby="active-ratings-title" className={styles.card}>
            <h2 id="active-ratings-title">Active Ratings</h2>
            {sessions.length ? (
                <ul className={styles.ratings}>
                    {sessions.map((session) => {
                        const control = controls.find(({ sessionId }) => sessionId === session.id);
                        return (
                            <li key={session.id}>
                                <div className={styles.copy}>
                                    <Link href={`/sessions/${session.id}`} prefetch={false}>
                                        <strong>{formatHubSessionTitle(session)}</strong>
                                        <span>
                                            {session.scheduledAt
                                                ? formatCalendarDate(session.scheduledAt)
                                                : 'Not scheduled'}
                                            {' · '}
                                            {session.progressCount ?? 0} of {session.acceptedCount}{' '}
                                            rated
                                        </span>
                                    </Link>
                                    {control?.status === 'unavailable' ? (
                                        <p role="status">
                                            Session controls changed or are unavailable. Refresh to
                                            update them.
                                        </p>
                                    ) : null}
                                </div>
                                {control?.status === 'ready' ? (
                                    <RatingClose
                                        sessionId={session.id}
                                        phaseVersion={control.phaseVersion}
                                        data={control.rating}
                                    >
                                        {(onClose) =>
                                            onClose ? (
                                                <Button
                                                    onClick={onClose}
                                                    size="small"
                                                    variant="secondary"
                                                >
                                                    Finish Session
                                                </Button>
                                            ) : null
                                        }
                                    </RatingClose>
                                ) : null}
                                {control?.status === 'unavailable' ? (
                                    <Button
                                        loading={isRefreshing}
                                        onClick={() => startTransition(() => router.refresh())}
                                        size="small"
                                        variant="secondary"
                                    >
                                        Refresh
                                    </Button>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p>No Sessions awaiting ratings.</p>
            )}
        </section>
    );
}
