import type { IClubHub } from '@pickflick/contracts';
import Link from 'next/link';

import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { getMonogram } from '#lib/format';

import styles from '../../page.module.scss';
import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';

export default function HubOverview({ hub }: { hub: IClubHub }) {
    const stats = hub.statistics;
    const tiles: {
        label: string;
        value: string | number | null;
        icon: TIconName;
        small?: boolean;
    }[] = [
        { label: 'Sessions watched', value: stats.sessionsWatched, icon: 'film-reel' },
        { label: 'Sessions this year', value: stats.sessionsThisYear, icon: 'clapperboard' },
        { label: 'Avg club rating', value: formatNumber(stats.averageRating), icon: 'star-circle' },
        {
            label: 'Total watch time, h',
            value: formatNumber(stats.totalWatchHours),
            icon: 'stopwatch',
        },
        { label: 'Most watched genre', value: stats.topGenre, icon: 'genre' },
        { label: 'Top director', value: stats.topDirector, icon: 'director', small: true },
        { label: 'Top actor', value: stats.topActor, icon: 'actor', small: true },
    ];
    return (
        <div className={styles.overview}>
            <section aria-label="Club statistics" className={styles.statistics}>
                {tiles.map((tile) => (
                    <div className={styles.stat} key={tile.label}>
                        <Icon name={tile.icon} />
                        <div>
                            <strong data-small={tile.small || undefined}>
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
                                <span aria-hidden="true">{getMonogram(member.displayName)}</span>
                                {member.displayName}
                                {member.role === 'ADMIN' ? ' (admin)' : ''}
                            </li>
                        ))}
                    </ul>
                </section>
                <ActiveSessionCard hub={hub} />
            </div>
            <SprocketDivider variant="section" />
            <section className={styles.card}>
                <h2>Recent Activity</h2>
                {hub.recentSessions.length ? (
                    <ul className={styles.activity}>
                        {hub.recentSessions.map((session) => (
                            <li key={session.id}>
                                <Link href={`/sessions/${session.id}`} prefetch={false}>
                                    {session.topic ?? session.movie?.title ?? 'Untitled Session'}
                                </Link>{' '}
                                · {session.phase.toLowerCase()} ·{' '}
                                <time dateTime={session.updatedAt}>
                                    {new Intl.DateTimeFormat('en', {
                                        dateStyle: 'medium',
                                        timeZone: 'UTC',
                                    }).format(new Date(session.updatedAt))}
                                </time>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No Session activity yet.</p>
                )}
            </section>
            {hub.historySessions.length ? (
                <details className={styles.history}>
                    <summary>Session history</summary>
                    <ul className={styles.activity}>
                        {hub.historySessions.map((session) => (
                            <li key={session.id}>
                                <Link href={`/sessions/${session.id}`}>
                                    {session.topic ?? session.movie?.title ?? 'Untitled Session'}
                                </Link>{' '}
                                · {session.phase.toLowerCase()}
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </div>
    );
}

function formatNumber(value: number | null) {
    return value === null
        ? null
        : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
}
