import type { IClubHub } from '@pickflick/contracts';
import Link from 'next/link';

import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';
import styles from './HubSessionCards.module.scss';

export default function HubSessionCards({ hub }: { hub: IClubHub }) {
    return (
        <div className={styles.grid}>
            <ActiveSessionCard hub={hub} compact />
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
                                        ? new Intl.DateTimeFormat('en', {
                                              dateStyle: 'medium',
                                              timeZone: 'UTC',
                                          }).format(new Date(session.scheduledAt))
                                        : 'Not scheduled'}{' '}
                                    · Awaiting ratings
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
