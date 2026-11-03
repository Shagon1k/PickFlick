import type { IClubHub, IClubHubSession } from '@pickflick/contracts';
import Link from 'next/link';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import AvatarGroup from '#components/ui/AvatarGroup/AvatarGroup';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import FilmProgress from '#components/ui/FilmProgress/FilmProgress';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { formatCalendarDate, formatCount } from '#lib/format';

import styles from './HubSessions.module.scss';
import SessionHistory from './SessionHistory';

/** The running Session stays in the Call Sheet; only unfinished Ratings precede history. */
export default function HubSessions({ hub }: { hub: IClubHub }) {
    return (
        <div className={styles.sessions}>
            {hub.ratingSessions.length ? (
                <>
                    <section aria-labelledby="open-ratings-heading">
                        <header className={styles.heading}>
                            <h2 id="open-ratings-heading">Open Ratings</h2>
                            <span>{hub.ratingSessions.length} open</span>
                        </header>
                        <ul className={styles.list}>
                            {hub.ratingSessions.map((session) => (
                                <li key={session.id}>
                                    <OpenRatingRow session={session} />
                                </li>
                            ))}
                        </ul>
                    </section>
                    <SprocketDivider variant="section" />
                </>
            ) : null}
            <SessionHistory
                key={`${hub.club.id}:${hub.club.membershipRole}`}
                clubId={hub.club.id}
                initialSessions={hub.historySessions}
                nextCursor={hub.historyNextCursor}
                canLogPast={hub.permissions.manageSessions}
            />
        </div>
    );
}

function OpenRatingRow({ session }: { session: IClubHubSession }) {
    const title = session.movie?.title ?? session.topic ?? 'Untitled Session';
    const progress = session.acceptedCount
        ? `${session.progressCount ?? 0} of ${session.acceptedCount} rated`
        : 'No current participants';
    const meta = [
        session.scheduledAt ? formatCalendarDate(session.scheduledAt) : 'Not scheduled',
        session.location,
        progress,
    ];
    return (
        <article
            className={`${styles.row} ${styles.ratingRow}`}
            data-color-reveal-trigger
            data-color-reveal-surface
        >
            <ColorReveal variant="surface" />
            <SearchPoster
                className={styles.poster}
                url={session.movie?.posterUrl ?? null}
                withColorReveal
            />
            <div className={styles.copy}>
                <Link
                    className={styles.ratingTitle}
                    href={`/sessions/${session.id}`}
                    prefetch={false}
                >
                    <strong>{title}</strong>
                </Link>
                <span>{meta.filter(Boolean).join(' · ')}</span>
            </div>
            <div className={styles.participants}>
                <AvatarGroup
                    items={session.participants ?? []}
                    label={`${formatCount(session.acceptedCount, 'participant')} in ${title}`}
                />
            </div>
            <div className={styles.ratingProgress}>
                <ColorReveal shouldFill>
                    <FilmProgress
                        compact
                        value={session.progressCount ?? 0}
                        max={session.acceptedCount}
                        label={progress}
                    />
                </ColorReveal>
            </div>
        </article>
    );
}
