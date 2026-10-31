import type { IClubHub, IClubHubSession } from '@pickflick/contracts';
import Link from 'next/link';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import ButtonLink from '#components/ui/Button/ButtonLink';
import FilmProgress from '#components/ui/FilmProgress/FilmProgress';
import { formatAverage, formatCalendarDate, formatCount } from '#lib/format';

import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';
import styles from './HubSessions.module.scss';

export default function HubSessions({ hub }: { hub: IClubHub }) {
    return (
        <div className={styles.sessions}>
            <h2>Active Sessions</h2>
            {hub.permissions.manageSessions ? (
                <ButtonLink href={`/clubs/${hub.club.id}/sessions/past/new`}>
                    Log a Past Session
                </ButtonLink>
            ) : null}
            {hub.activeSession ? <ActiveSessionCard hub={hub} /> : null}
            <section aria-labelledby="active-ratings-heading">
                <h2 id="active-ratings-heading">Active Ratings</h2>
                <SessionRows sessions={hub.ratingSessions} empty="No Sessions awaiting ratings." />
            </section>
            <section aria-labelledby="session-history-heading">
                <h2 id="session-history-heading">History</h2>
                <SessionRows sessions={hub.historySessions} empty="No completed Sessions yet." />
            </section>
        </div>
    );
}

function SessionRows({ sessions, empty }: { sessions: IClubHubSession[]; empty: string }) {
    if (!sessions.length) return <p>{empty}</p>;
    return (
        <ul className={styles.list}>
            {sessions.map((session) => (
                <li key={session.id}>
                    <Link className={styles.row} href={`/sessions/${session.id}`} prefetch={false}>
                        <SearchPoster
                            className={styles.poster}
                            url={session.movie?.posterUrl ?? null}
                        />
                        <div className={styles.copy}>
                            <strong>
                                {session.movie?.title ?? session.topic ?? 'Untitled Session'}
                            </strong>
                            <span>
                                {session.scheduledAt
                                    ? formatCalendarDate(session.scheduledAt)
                                    : 'Not scheduled'}
                                {session.location ? ` · ${session.location}` : ''} ·{' '}
                                {formatCount(session.acceptedCount, 'attendee')}
                            </span>
                            {session.phase === 'RATING' ? (
                                <>
                                    <FilmProgress
                                        value={session.progressCount ?? 0}
                                        max={session.acceptedCount}
                                        label={`${session.progressCount ?? 0} of ${session.acceptedCount} rated`}
                                    />
                                </>
                            ) : null}
                        </div>
                        <span className={styles.score}>
                            <SessionScore session={session} />
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function SessionScore({ session }: { session: IClubHubSession }) {
    if (session.phase === 'RATING')
        return (
            <>
                <span>
                    {session.progressCount ?? 0}/{session.acceptedCount}
                </span>
                <small>rated</small>
            </>
        );
    if (session.phase === 'CANCELLED') return <>Cancelled</>;
    return (
        <>
            <span>
                {session.ratingAverage === null ? '—' : formatAverage(session.ratingAverage)}
            </span>
            <small>Club score</small>
        </>
    );
}
