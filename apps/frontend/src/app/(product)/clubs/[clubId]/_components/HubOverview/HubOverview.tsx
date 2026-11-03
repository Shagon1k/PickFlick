import type { IClubHub, IClubHubSession } from '@pickflick/contracts';
import Link from 'next/link';

import Avatar from '#components/ui/Avatar/Avatar';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import LocalTime from '#components/ui/LocalTime/LocalTime';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { formatAverage, formatHours } from '#lib/format';

import styles from '../../page.module.scss';
import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';

export default function HubOverview({ hub }: { hub: IClubHub }) {
    const stats = hub.statistics;
    const tiles: {
        label: string;
        value: string | number | null;
        icon: TIconName;
        isSmall?: boolean;
    }[] = [
        { label: 'Sessions watched', value: stats.sessionsWatched, icon: 'film-reel' },
        { label: 'Sessions this year', value: stats.sessionsThisYear, icon: 'clapperboard' },
        {
            label: 'Avg club rating',
            value: stats.averageRating === null ? null : formatAverage(stats.averageRating),
            icon: 'star-circle',
        },
        {
            label: 'Total watch time, h',
            value: stats.totalWatchHours === null ? null : formatHours(stats.totalWatchHours),
            icon: 'stopwatch',
        },
        { label: 'Most watched genre', value: stats.topGenre, icon: 'genre' },
        { label: 'Top director', value: stats.topDirector, icon: 'director', isSmall: true },
        { label: 'Top actor', value: stats.topActor, icon: 'actor', isSmall: true },
    ];
    return (
        <div className={styles.overview}>
            <section aria-label="Club statistics" className={styles.statistics}>
                {tiles.map((tile) => (
                    <div className={styles.stat} key={tile.label}>
                        <Icon name={tile.icon} />
                        <div>
                            <strong data-small={tile.isSmall || undefined}>
                                {tile.value ?? '—'}
                            </strong>
                            <span>{tile.label}</span>
                        </div>
                    </div>
                ))}
            </section>
            <div className={styles.cards}>
                <section className={styles.card}>
                    <div className={styles.cardHeading}>
                        <h2>Members</h2>
                        <span>
                            {hub.memberCount} / {hub.memberLimit}
                        </span>
                    </div>
                    <ul className={styles.memberPills}>
                        {hub.members.map((member) => (
                            <li key={member.id} data-admin={member.role === 'ADMIN' || undefined}>
                                <span className={styles.memberAvatar}>
                                    <Avatar
                                        name={member.displayName}
                                        src={member.avatarUrl}
                                        size="small"
                                        withColorReveal={false}
                                    />
                                </span>
                                {member.displayName}
                                {member.role === 'ADMIN' ? ' (admin)' : ''}
                            </li>
                        ))}
                    </ul>
                </section>
                <ActiveSessionCard
                    hub={hub}
                    actions={
                        !hub.activeSession && hub.permissions.manageSessions ? (
                            <div className={styles.emptySessionActions}>
                                <ButtonLink
                                    fullWidth
                                    href={`/clubs/${hub.club.id}/sessions/new?returnTo=${encodeURIComponent(`/clubs/${hub.club.id}`)}`}
                                    variant="primary"
                                >
                                    <Icon name="calendar" />
                                    <span>Schedule New</span>
                                </ButtonLink>
                                <ButtonLink
                                    fullWidth
                                    href={`/clubs/${hub.club.id}/sessions/past/new?returnTo=${encodeURIComponent(`/clubs/${hub.club.id}`)}`}
                                >
                                    <Icon name="clock" />
                                    <span>Log Past</span>
                                </ButtonLink>
                            </div>
                        ) : undefined
                    }
                />
            </div>
            <SprocketDivider variant="section" />
            <section className={styles.card}>
                <h2>Recent Activity</h2>
                {hub.recentSessions.length ? (
                    <ul className={styles.activity}>
                        {hub.recentSessions.map((session) => {
                            const [before, after] = describeActivity(session);
                            return (
                                <li key={session.id}>
                                    {before}
                                    <Link href={`/sessions/${session.id}`} prefetch={false}>
                                        {session.movie?.title ??
                                            session.topic ??
                                            'Untitled Session'}
                                    </Link>
                                    {after} ·{' '}
                                    <LocalTime format="relative" value={session.updatedAt} />
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p>No Session activity yet.</p>
                )}
            </section>
        </div>
    );
}

/** The words around the Session's title, the way the member event feed will read later. */
const ACTIVITY: Record<IClubHubSession['phase'], [string, string]> = {
    NOMINATION: ['Nominations opened for ', ''],
    SELECTION: ['Selection opened for ', ''],
    WATCHING: ['', ' was picked for the screening'],
    RATING: ['Rating opened for ', ''],
    COMPLETED: ['Screened ', ''],
    CANCELLED: ['Cancelled ', ''],
};

/** A Session's latest step in words, with the Club score once it is known. */
function describeActivity(session: IClubHubSession): [string, string] {
    if (session.phase === 'COMPLETED' && session.ratingAverage !== null)
        return ['Screened ', `, rated ${formatAverage(session.ratingAverage)}`];
    return ACTIVITY[session.phase];
}
