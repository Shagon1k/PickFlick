import type { IClubHubSession } from '@pickflick/contracts';
import Image from 'next/image';
import Link from 'next/link';

import choosingPanda from '#brand/panda-choosing.webp';
import SearchPoster from '#components/movies/SearchPoster/SearchPoster';

import styles from './CallSheet.module.scss';

export default function CallSheet({
    session,
    memberCount,
}: {
    session?: IClubHubSession;
    memberCount: number;
}) {
    if (!session)
        return (
            <section className={styles.empty} aria-label="Screening Call Sheet">
                <p>Awaiting a Session</p>
                <span>No active Session is on the Call Sheet yet.</span>
            </section>
        );
    const scheduled = session.scheduledAt ? new Date(session.scheduledAt) : null;
    const unit = scheduled
        ? new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(scheduled)
        : 'Screening';
    const date = scheduled
        ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
              scheduled,
          )
        : '—';
    // Sessions store a date at midnight UTC; only a real time earns the Call time slot.
    const hasTime = scheduled !== null && scheduled.getUTCHours() + scheduled.getUTCMinutes() > 0;
    const time = hasTime
        ? new Intl.DateTimeFormat('en', { timeStyle: 'short', timeZone: 'UTC' }).format(scheduled)
        : null;
    const hasSelectedFilm = ['WATCHING', 'RATING', 'COMPLETED'].includes(session.phase);
    const title = hasSelectedFilm
        ? (session.movie?.title ?? session.topic ?? 'Film unavailable')
        : (session.topic ?? 'Untitled Session');
    const fields = getPhaseFields(session, hasSelectedFilm);
    return (
        <Link
            className={styles.sheet}
            href={`/sessions/${session.id}`}
            prefetch={false}
            aria-label={`Open Session: ${title}`}
        >
            <header className={styles.head}>
                <span>Call sheet {String(session.ordinal).padStart(CALL_SHEET_DIGITS, '0')}</span>
                <div className={styles.headMeta}>
                    <span className={styles.unit}>{unit} unit</span>
                    <span className={styles.phase}>
                        <span>Current phase</span>
                        <i>/</i>
                        <b>{session.phase.toLowerCase()}</b>
                    </span>
                </div>
            </header>
            <div className={styles.layout}>
                <dl className={styles.fields}>
                    <div className={styles.picture}>
                        <dt>{hasSelectedFilm ? 'Picture' : 'Session'}</dt>
                        <dd>{title}</dd>
                    </div>
                    {time ? (
                        <div>
                            <dt>Call time</dt>
                            <dd title="Scheduled time in UTC">{time}</dd>
                        </div>
                    ) : (
                        <div className={styles.location}>
                            <dt>Location</dt>
                            <dd title={session.location ?? undefined}>{session.location ?? '—'}</dd>
                        </div>
                    )}
                    <div>
                        <dt>Date</dt>
                        <dd>{date}</dd>
                    </div>
                    {fields.map((field) => (
                        <div key={field.label}>
                            <dt>{field.label}</dt>
                            <dd>{field.value}</dd>
                        </div>
                    ))}
                </dl>
                <figure className={styles.still}>
                    <div className={styles.frameMeta}>
                        <span>{hasSelectedFilm ? 'Selected film' : 'Film selection'}</span>
                        <span>
                            {session.nominatedCount}{' '}
                            {session.nominatedCount === 1 ? 'nomination' : 'nominations'}
                        </span>
                    </div>
                    {session.movie ? (
                        <SearchPoster className={styles.image} url={session.movie.posterUrl} />
                    ) : (
                        // The picture is still being chosen; nominations stay behind Club visibility rules.
                        <span className={styles.image} aria-hidden="true">
                            <Image className={styles.mascot} src={choosingPanda} alt="" />
                        </span>
                    )}
                    <figcaption className={styles.frameMeta}>
                        <span>{session.acceptedCount} confirmed</span>
                        <span>{Math.max(0, memberCount - session.acceptedCount)} not joined</span>
                    </figcaption>
                </figure>
            </div>
        </Link>
    );
}

function getPhaseFields(session: IClubHubSession, hasSelectedFilm: boolean) {
    if (hasSelectedFilm)
        return [
            { label: 'Runtime', value: formatRuntime(session.movie?.runtime ?? null) },
            { label: 'Genre', value: session.movie?.genres[0] ?? '—' },
        ];
    return [
        {
            label: session.phase === 'SELECTION' ? 'Ballots' : 'Nominated',
            value: `${session.progressCount ?? 0}/${session.acceptedCount}`,
        },
        {
            label: session.phase === 'SELECTION' ? 'Nominations' : 'Participants',
            value: String(
                session.phase === 'SELECTION' ? session.nominatedCount : session.acceptedCount,
            ),
        },
    ];
}

function formatRuntime(minutes: number | null) {
    if (!minutes) return '—';
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const remainder = minutes % MINUTES_PER_HOUR;
    return hours ? `${hours}h ${remainder}m` : `${minutes}m`;
}

const CALL_SHEET_DIGITS = 3;
const MINUTES_PER_HOUR = 60;
