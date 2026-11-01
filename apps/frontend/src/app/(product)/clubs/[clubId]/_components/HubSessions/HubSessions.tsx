import { type IClubHub, type IClubHubSession } from '@pickflick/contracts';
import Link from 'next/link';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import ButtonLink from '#components/ui/Button/ButtonLink';
import FilmProgress from '#components/ui/FilmProgress/FilmProgress';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { formatAverage, formatCalendarDate, formatCount } from '#lib/format';

import styles from './HubSessions.module.scss';

/** One list of what is running and one of what is done, with the Session actions under the first. */
export default function HubSessions({ hub }: { hub: IClubHub }) {
    const active = [...(hub.activeSession ? [hub.activeSession] : []), ...hub.ratingSessions];
    return (
        <div className={styles.sessions}>
            <section aria-labelledby="active-sessions-heading">
                <header className={styles.heading}>
                    <h2 id="active-sessions-heading">Active Sessions</h2>
                    <span>{formatCount(active.length, 'running', 'running')}</span>
                </header>
                <SessionRows
                    empty="Nothing is running right now."
                    memberCount={hub.memberCount}
                    sessions={active}
                />
                {hub.permissions.manageSessions ? (
                    <div className={styles.actions}>
                        {hub.activeSession ? null : (
                            <ButtonLink
                                href={`/clubs/${hub.club.id}/sessions/new`}
                                variant="primary"
                            >
                                Schedule a Session
                            </ButtonLink>
                        )}
                        <ButtonLink href={`/clubs/${hub.club.id}/sessions/past/new`}>
                            Log a Past Session
                        </ButtonLink>
                    </div>
                ) : null}
            </section>
            <SprocketDivider variant="section" />
            <section aria-labelledby="session-history-heading">
                <header className={styles.heading}>
                    <h2 id="session-history-heading">History</h2>
                    <span>{formatCount(hub.completedSessionCount, 'Session')}</span>
                </header>
                <SessionRows
                    empty="No completed Sessions yet."
                    memberCount={hub.memberCount}
                    sessions={hub.historySessions}
                />
            </section>
        </div>
    );
}

function SessionRows({
    sessions,
    memberCount,
    empty,
}: {
    sessions: IClubHubSession[];
    memberCount: number;
    empty: string;
}) {
    if (!sessions.length) return <p>{empty}</p>;
    return (
        <ul className={styles.list}>
            {sessions.map((session) => {
                const progress = getProgress(session, memberCount);
                const meta = [
                    progress?.label,
                    session.scheduledAt ? formatCalendarDate(session.scheduledAt) : 'Not scheduled',
                    session.location,
                    progress ? null : formatCount(session.acceptedCount, 'attendee'),
                ];
                return (
                    <li key={session.id}>
                        <Link
                            className={styles.row}
                            href={`/sessions/${session.id}`}
                            prefetch={false}
                        >
                            <SearchPoster
                                className={styles.poster}
                                url={session.movie?.posterUrl ?? null}
                            />
                            <div className={styles.copy}>
                                <strong>
                                    {session.movie?.title ?? session.topic ?? 'Untitled Session'}
                                </strong>
                                <span>{meta.filter(Boolean).join(' · ')}</span>
                                {progress ? (
                                    <FilmProgress
                                        value={progress.value}
                                        max={progress.max}
                                        label={progress.label}
                                    />
                                ) : null}
                            </div>
                            <span className={styles.score}>
                                <SessionScore session={session} />
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

/** How far a running Session has come; a finished one has no progress to show. */
function getProgress(session: IClubHubSession, memberCount: number) {
    const done = session.progressCount ?? 0;
    const of = (value: number, max: number, verb: string) => ({
        value,
        max,
        label: `${value} of ${max} ${verb}`,
    });
    if (session.phase === 'NOMINATION') return of(done, memberCount, 'nominated');
    if (session.phase === 'SELECTION') return of(done, session.acceptedCount, 'scored');
    if (session.phase === 'WATCHING') return of(session.acceptedCount, memberCount, 'joined');
    if (session.phase === 'RATING') return of(done, session.acceptedCount, 'rated');
    return null;
}

function SessionScore({ session }: { session: IClubHubSession }) {
    if (session.phase === 'CANCELLED') return <>Cancelled</>;
    if (session.phase !== 'COMPLETED')
        return <span className={styles.badge}>{session.phase.toLowerCase()}</span>;
    return (
        <>
            <span>
                {session.ratingAverage === null ? '—' : formatAverage(session.ratingAverage)}
            </span>
            <small>Club score</small>
        </>
    );
}
