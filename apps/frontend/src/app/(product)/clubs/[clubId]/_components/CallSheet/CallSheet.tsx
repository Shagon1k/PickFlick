import { type IClubHubSession, isFilmSessionPhase } from '@pickflick/contracts';
import Image from 'next/image';
import Link from 'next/link';

import choosingPanda from '#brand/panda-choosing.webp';
import projectionistPanda from '#brand/panda-projectionist.webp';
import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import { getProgressTotal } from '#components/sessions/club-session-text';
import ButtonLink from '#components/ui/Button/ButtonLink';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Icon from '#components/ui/Icon/Icon';
import { formatCount, formatRuntime, toScreeningTime } from '#lib/format';

import styles from './CallSheet.module.scss';

export default function CallSheet({
    session,
    memberCount,
    scheduleHref,
}: {
    session?: IClubHubSession;
    memberCount: number;
    /** Present when the viewer may schedule the next Session. */
    scheduleHref?: string;
}) {
    if (!session) return <EmptyCallSheet scheduleHref={scheduleHref} />;
    const scheduled = session.scheduledAt ? new Date(session.scheduledAt) : null;
    const unit = scheduled
        ? new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(scheduled)
        : 'Screening';
    const date = scheduled
        ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
              scheduled,
          )
        : '—';
    // A date-only Session has no time, so it shows its location in the Call time slot instead.
    const hasTime = Boolean(session.scheduledAt && toScreeningTime(session.scheduledAt));
    const time =
        scheduled && hasTime
            ? new Intl.DateTimeFormat('en', { timeStyle: 'short', timeZone: 'UTC' }).format(
                  scheduled,
              )
            : null;
    const hasSelectedFilm = isFilmSessionPhase(session.phase);
    const title = hasSelectedFilm
        ? (session.movie?.title ?? session.topic ?? 'Film unavailable')
        : (session.topic ?? 'Untitled Session');
    const fields = getPhaseFields(session, hasSelectedFilm, memberCount);
    return (
        <Link
            className={styles.sheet}
            data-color-reveal-trigger
            data-color-reveal-surface
            href={`/sessions/${session.id}`}
            prefetch={false}
            aria-label={`Open Session: ${title}`}
        >
            <ColorReveal variant="surface" />
            <header className={styles.head}>
                <ColorReveal variant="outline" />
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
                    <Field
                        className={styles.picture}
                        label={hasSelectedFilm ? 'Picture' : 'Session'}
                        value={title}
                    />
                    {time ? (
                        <Field label="Call time" value={time} />
                    ) : (
                        <Field
                            className={styles.location}
                            label="Location"
                            value={session.location ?? '—'}
                            title={session.location ?? undefined}
                        />
                    )}
                    <Field label="Date" value={date} />
                    {fields.map((field) => (
                        <Field key={field.label} label={field.label} value={field.value} />
                    ))}
                </dl>
                <figure className={styles.still}>
                    <ColorReveal variant="outline" />
                    <div className={styles.frameMeta}>
                        <span>{hasSelectedFilm ? 'Selected film' : 'Film selection'}</span>
                        <span>{formatCount(session.nominatedCount, 'nomination')}</span>
                    </div>
                    {session.movie ? (
                        <SearchPoster
                            className={styles.image}
                            url={session.movie.posterUrl}
                            withColorReveal
                        />
                    ) : (
                        // The picture is still being chosen; nominations stay behind Club visibility rules.
                        <span className={styles.image} aria-hidden="true">
                            <ColorReveal shouldFill>
                                <Image className={styles.mascot} src={choosingPanda} alt="" />
                            </ColorReveal>
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

/** The same sheet waits for the next screening instead of collapsing into a note. */
function EmptyCallSheet({ scheduleHref }: { scheduleHref?: string }) {
    return (
        <section
            className={styles.sheet}
            aria-label="Screening Call Sheet"
            data-empty
            data-color-reveal-trigger
            data-color-reveal-surface
        >
            <ColorReveal variant="surface" />
            <header className={styles.head}>
                <ColorReveal variant="outline" />
                <span>Call sheet —</span>
                <div className={styles.headMeta}>
                    <span className={styles.phase}>
                        <span>Current phase</span>
                        <i>/</i>
                        <b>none</b>
                    </span>
                </div>
                {scheduleHref ? (
                    <div className={styles.scheduleAction}>
                        <ButtonLink href={scheduleHref} size="small" variant="subtle">
                            <Icon name="calendar" />
                            Schedule New
                        </ButtonLink>
                    </div>
                ) : null}
            </header>
            <div className={styles.layout}>
                <div className={styles.waiting}>
                    <p className={styles.waitingKicker}>Next screening</p>
                    <h2>No screening scheduled</h2>
                </div>
                <figure className={styles.still} aria-hidden="true">
                    <ColorReveal variant="outline" />
                    <div className={styles.frameMeta}>
                        <span>Projector</span>
                        <span>Standing by</span>
                    </div>
                    <span className={styles.image}>
                        <ColorReveal shouldFill>
                            <Image className={styles.mascot} src={projectionistPanda} alt="" />
                        </ColorReveal>
                    </span>
                    <figcaption className={styles.frameMeta}>
                        <span>Reel 00</span>
                        <span>Lights down soon</span>
                    </figcaption>
                </figure>
            </div>
        </section>
    );
}

function Field({
    label,
    value,
    className,
    title,
}: {
    label: string;
    value: string;
    className?: string;
    title?: string;
}) {
    return (
        <div className={className}>
            <dt>{label}</dt>
            <dd title={title}>{value}</dd>
            <dd className={styles.fieldOutline} aria-hidden="true">
                <ColorReveal variant="outline" />
            </dd>
        </div>
    );
}

function getPhaseFields(session: IClubHubSession, hasSelectedFilm: boolean, memberCount: number) {
    if (hasSelectedFilm)
        return [
            { label: 'Runtime', value: formatRuntime(session.movie?.runtime ?? null) ?? '—' },
            { label: 'Genre', value: session.movie?.genres[0] ?? '—' },
        ];
    return [
        {
            label: session.phase === 'SELECTION' ? 'Ballots' : 'Nominated',
            value: `${session.progressCount ?? 0}/${getProgressTotal(session, memberCount)}`,
        },
        {
            label: session.phase === 'SELECTION' ? 'Nominations' : 'Participants',
            value: String(
                session.phase === 'SELECTION' ? session.nominatedCount : session.acceptedCount,
            ),
        },
    ];
}

const CALL_SHEET_DIGITS = 3;
