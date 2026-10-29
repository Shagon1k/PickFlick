import type { IClubHub } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { formatUtcDate } from '#lib/format';

import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';
import styles from './HubSessionCards.module.scss';

export default function HubSessionCards({
    hub,
    actions,
    ratingsOnly = false,
}: {
    hub: IClubHub;
    actions?: ReactNode;
    ratingsOnly?: boolean;
}) {
    return (
        <div className={styles.grid} data-ratings-only={ratingsOnly || undefined}>
            {!ratingsOnly ? <ActiveSessionCard actions={actions} compact hub={hub} /> : null}
            <section className={styles.card}>
                <h2>Active Ratings</h2>
                {hub.ratingSessions.length ? (
                    <ul className={styles.ratings}>
                        {hub.ratingSessions.map((session) => (
                            <li key={session.id}>
                                <Link href={`/sessions/${session.id}`} prefetch={false}>
                                    {session.movie?.title ?? session.topic ?? 'Untitled Session'}
                                </Link>
                                <p>
                                    {session.scheduledAt
                                        ? formatUtcDate(session.scheduledAt)
                                        : 'Not scheduled'}{' '}
                                    · {session.progressCount ?? 0} of {session.acceptedCount} rated
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No Sessions awaiting ratings.</p>
                )}
            </section>
        </div>
    );
}
