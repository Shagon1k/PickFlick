import type { IClubHubSession } from '@pickflick/contracts';
import Link from 'next/link';

import { formatUtcDate } from '#lib/format';

import styles from './ActiveRatings.module.scss';

/** Rating Sessions still collecting responses; they never block the Club's next Session. */
export default function ActiveRatings({ sessions }: { sessions: IClubHubSession[] }) {
    return (
        <section className={styles.card}>
            <h2>Active Ratings</h2>
            {sessions.length ? (
                <ul className={styles.ratings}>
                    {sessions.map((session) => (
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
    );
}
