import type { IClubHub } from '@pickflick/contracts';
import Link from 'next/link';

import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { formatAverage, formatHours, formatUtcDate, getMonogram } from '#lib/format';

import styles from '../../page.module.scss';
import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';
import HubSessionCards from '../HubSessionCards/HubSessionCards';

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
        { label: 'Top director', value: stats.topDirector, icon: 'director', small: true },
        { label: 'Top actor', value: stats.topActor, icon: 'actor', small: true },
    ];
    const visibleTiles = hub.club.tier === 'FREE' ? tiles.slice(0, 2) : tiles;
    return (
        <div className={styles.overview}>
            <section
                aria-label="Club statistics"
                className={styles.statistics}
                data-basic={hub.club.tier === 'FREE' || undefined}
            >
                {visibleTiles.map((tile) => (
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
            {hub.club.tier === 'FREE' ? (
                <p>Extended Club analytics and the ratings leaderboard are available with Pro.</p>
            ) : (
                <p>
                    Ratings use completed results you can view. Metadata summaries need film details
                    for every completed screening.
                </p>
            )}
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
            {hub.ratingSessions.length ? <HubSessionCards hub={hub} ratingsOnly /> : null}
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
                                    {formatUtcDate(session.updatedAt)}
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
