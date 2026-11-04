import { type ISessionRoster, isFilmSessionPhase, type TSession } from '@pickflick/contracts';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import Icon from '#components/ui/Icon/Icon';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import { formatAverage, toScreeningTime } from '#lib/format';

import styles from '../../page.module.scss';

export default function SessionFacts({
    session,
    roster,
    isLoading = false,
}: { session: TSession } & (
    | { roster: ISessionRoster; isLoading?: false }
    | { roster?: never; isLoading: true }
)) {
    const panel = getCompanion(session, roster, isLoading);
    const date = session.scheduledAt
        ? new Intl.DateTimeFormat('en', {
              dateStyle: 'long',
              ...(toScreeningTime(session.scheduledAt) ? { timeStyle: 'short' } : {}),
              timeZone: 'UTC',
          }).format(new Date(session.scheduledAt))
        : 'Not scheduled';
    const participants =
        roster?.participants
            .filter((participant) => participant.status === 'ACCEPTED')
            .map((participant) => participant.displayName)
            .join(' • ') || (session.type === 'PAST' ? 'Not recorded' : 'No accepted participants');
    const value = (text: string) => (isLoading ? <Skeleton text={text} /> : text);
    return (
        <section
            className={clsx(styles.detailsGrid, !panel && styles.detailsSingle)}
            aria-label="Session details"
        >
            <div className={styles.card}>
                <dl className={styles.facts}>
                    <div>
                        <dt>
                            <Icon name="calendar" />
                            {isFilmSessionPhase(session.phase) ? 'Watched' : 'Date'}
                        </dt>
                        <dd>{value(date)}</dd>
                    </div>
                    <div>
                        <dt>
                            <Icon name="pin" />
                            Location
                        </dt>
                        <dd>{value(session.location ?? 'Not set')}</dd>
                    </div>
                    <div>
                        <dt>
                            <Icon name="members" />
                            Participants
                        </dt>
                        <dd>{isLoading ? <Skeleton width="half" /> : participants}</dd>
                    </div>
                    <div>
                        <dt>
                            <Icon name="bulb" />
                            Topic
                        </dt>
                        <dd>{value(session.topic ?? 'Not set')}</dd>
                    </div>
                    {session.notes ? (
                        <div>
                            <dt>
                                <Icon name="document" />
                                Notes
                            </dt>
                            <dd className={styles.notes}>{value(session.notes)}</dd>
                        </div>
                    ) : null}
                </dl>
                {session.phase === 'CANCELLED' ? (
                    <p role="status">This Session was cancelled. Its history is preserved.</p>
                ) : null}
            </div>
            {panel}
        </section>
    );
}

/** The companion beside the facts: phase progress, the coming chat, or the club score. */
function getCompanion(
    session: TSession,
    roster: ISessionRoster | undefined,
    isLoading: boolean,
): ReactNode {
    const submitted = session.nominations?.nominatedCount ?? session.selection?.submittedCount;
    if (submitted !== undefined)
        return (
            <div className={styles.metric}>
                <strong data-loading={isLoading || undefined}>
                    {isLoading ? (
                        <Skeleton shouldFill />
                    ) : (
                        <>
                            {submitted}/{session.nominations?.memberCount ?? roster?.acceptedCount}
                        </>
                    )}
                </strong>
                <span>{session.phase === 'NOMINATION' ? 'Nominated' : 'Selected'}</span>
            </div>
        );
    if (session.phase === 'WATCHING')
        return (
            <div className={styles.chatStub}>
                <span aria-hidden="true">
                    <Icon name="chat" />
                </span>
                <h3>Chat with your club in real time</h3>
                <p>
                    Discuss the film while watching. Reactions, theories, and live commentary — all
                    in one place.
                </p>
                <small>Coming soon</small>
            </div>
        );
    const average = session.rating?.results?.average ?? null;
    const averageLabel = average === null ? '—' : formatAverage(average);
    if (session.phase === 'RATING' || session.phase === 'COMPLETED')
        return (
            <div className={styles.metric}>
                <strong data-loading={isLoading || undefined}>
                    {isLoading ? <Skeleton shouldFill /> : averageLabel}
                </strong>
                <span>Club score</span>
            </div>
        );
    return null;
}
