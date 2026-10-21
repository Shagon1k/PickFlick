import type { ISessionRoster, TSession } from '@pickflick/contracts';

import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon from '#components/ui/Icon/Icon';
import { formatUtcDateTime, toIsoDate } from '#lib/format';

import styles from '../../page.module.scss';

export default function SessionFacts({
    session,
    roster,
}: {
    session: TSession;
    roster: ISessionRoster;
}) {
    const submitted = session.nominations?.nominatedCount ?? session.selection?.submittedCount;
    return (
        <section className={styles.detailsGrid} aria-label="Session details">
            <div className={styles.card}>
                <dl className={styles.facts}>
                    <div>
                        <dt>
                            <Icon name="clock" />
                            Date
                        </dt>
                        <dd>
                            {session.scheduledAt ? toIsoDate(session.scheduledAt) : 'Not scheduled'}
                        </dd>
                    </div>
                    <div>
                        <dt>
                            <Icon name="club-building" />
                            Location
                        </dt>
                        <dd>{session.location ?? 'Not set'}</dd>
                    </div>
                    <div>
                        <dt>
                            <Icon name="members" />
                            Participants
                        </dt>
                        <dd>
                            {roster.participants
                                .filter((participant) => participant.status === 'ACCEPTED')
                                .map((participant) => participant.displayName)
                                .join(' · ') || 'No accepted participants'}
                        </dd>
                    </div>
                    <div>
                        <dt>
                            <Icon name="question" />
                            Topic
                        </dt>
                        <dd>{session.topic ?? 'Not set'}</dd>
                    </div>
                    {session.notes ? (
                        <div>
                            <dt>
                                <Icon name="book" />
                                Notes
                            </dt>
                            <dd className={styles.notes}>{session.notes}</dd>
                        </div>
                    ) : null}
                    {session.deadlineAt ? (
                        <div>
                            <dt>
                                <Icon name="clock" />
                                Nomination deadline
                            </dt>
                            <dd>{formatUtcDateTime(session.deadlineAt)}</dd>
                        </div>
                    ) : null}
                </dl>
                {session.movieId ? (
                    <ButtonLink href={`/movies/${session.movieId}`}>View selected Movie</ButtonLink>
                ) : null}
                {session.phase === 'CANCELLED' ? (
                    <p role="status">This Session was cancelled. Its history is preserved.</p>
                ) : null}
            </div>
            {submitted !== undefined ? (
                <div className={styles.metric}>
                    <strong>
                        {submitted}/{roster.acceptedCount}
                    </strong>
                    <span>{session.phase === 'NOMINATION' ? 'Nominated' : 'Selected'}</span>
                </div>
            ) : null}
        </section>
    );
}
