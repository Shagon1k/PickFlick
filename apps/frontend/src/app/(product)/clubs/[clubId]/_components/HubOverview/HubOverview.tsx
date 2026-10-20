import { type IClubHub, type IClubHubSession, isBlockingSessionPhase } from '@pickflick/contracts';
import Link from 'next/link';

import ButtonLink from '#components/ui/Button/ButtonLink';

import styles from '../../page.module.scss';

interface IHubOverviewProps {
    hub: IClubHub;
}

function formatSessionName(session: IClubHubSession): string {
    return session.topic ?? 'Untitled Session';
}

function formatSessionDate(value: string): string {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(value),
    );
}

export default function HubOverview({ hub }: IHubOverviewProps) {
    const { club, activeSession } = hub;
    const canCreate =
        hub.permissions.manageSessions && !isBlockingSessionPhase(activeSession?.phase);
    return (
        <div className={styles.overview}>
            {canCreate ? (
                <ButtonLink href={`/clubs/${club.id}/sessions/new`} variant="primary">
                    Create Session
                </ButtonLink>
            ) : null}
            <section aria-label="Club statistics" className={styles.stats}>
                <div>
                    <strong>{hub.memberCount}</strong>
                    <span>Members</span>
                </div>
                <div>
                    <strong>{hub.sessionCount}</strong>
                    <span>Sessions</span>
                </div>
                <div>
                    <strong>{hub.completedSessionCount}</strong>
                    <span>Completed Sessions</span>
                </div>
            </section>
            <div className={styles.cards}>
                <section className={styles.card}>
                    <h2>Members</h2>
                    <p>{hub.memberCount} members in this Club</p>
                    <p className={styles.quiet}>Your role: {club.membershipRole.toLowerCase()}</p>
                </section>
                <section className={styles.card}>
                    <h2>Active Session</h2>
                    {activeSession ? (
                        <>
                            <p>
                                <Link href={`/sessions/${activeSession.id}`}>
                                    {formatSessionName(activeSession)}
                                </Link>
                            </p>
                            <p className={styles.quiet}>
                                Phase: {activeSession.phase.toLowerCase()}
                            </p>
                        </>
                    ) : (
                        <p className={styles.quiet}>
                            No active Session. Your next screening will appear here.
                        </p>
                    )}
                </section>
            </div>
            <SessionRows
                title="Active Ratings"
                sessions={hub.ratingSessions}
                empty="No Sessions awaiting ratings."
            />
            <SessionRows
                title="Session history"
                sessions={hub.historySessions}
                empty="No completed or cancelled Sessions yet."
            />
            <section className={styles.card}>
                <h2>Recent Activity</h2>
                {hub.recentSessions.length > 0 ? (
                    <ul className={styles.activity}>
                        {hub.recentSessions.map((session) => (
                            <li key={session.id}>
                                <span>
                                    <Link href={`/sessions/${session.id}`}>
                                        {formatSessionName(session)}
                                    </Link>{' '}
                                    · {session.phase.toLowerCase()}
                                </span>
                                <time dateTime={session.updatedAt}>
                                    {formatSessionDate(session.updatedAt)}
                                </time>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={styles.quiet}>No Session activity yet.</p>
                )}
            </section>
        </div>
    );
}

function SessionRows({
    title,
    sessions,
    empty,
}: {
    title: string;
    sessions: IClubHubSession[];
    empty: string;
}) {
    return (
        <section className={styles.card}>
            <h2>{title}</h2>
            {sessions.length ? (
                <ul className={styles.activity}>
                    {sessions.map((session) => (
                        <li key={session.id}>
                            <Link href={`/sessions/${session.id}`}>
                                {formatSessionName(session)}
                            </Link>
                            <span>{session.phase.toLowerCase()}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={styles.quiet}>{empty}</p>
            )}
        </section>
    );
}
