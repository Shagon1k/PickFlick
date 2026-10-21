import type { TMovieDetails, TSession } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode, RefObject } from 'react';

import SessionLink from '#components/sessions/SessionLink/SessionLink';
import FilmStripMenu, {
    type IFilmStripMenuProps,
} from '#components/ui/FilmStripMenu/FilmStripMenu';
import Icon from '#components/ui/Icon/Icon';

import styles from '../../page.module.scss';
import NominationDeadline from '../NominationDeadline/NominationDeadline';

export default function SessionHeader({
    session,
    movie,
    participation,
    renderedAt,
    onKick,
    onClosePhase,
    closePhaseLabel,
    headingRef,
    onEdit,
    onCancel,
}: {
    session: TSession;
    movie: TMovieDetails | null;
    participation: ReactNode;
    renderedAt: number;
    onKick?: () => void;
    onClosePhase?: () => void;
    closePhaseLabel: string;
    headingRef: RefObject<HTMLHeadingElement | null>;
    onEdit: () => void;
    onCancel: () => void;
}) {
    const items = getMenuItems(session, {
        onKick,
        onClosePhase,
        closePhaseLabel,
        onEdit,
        onCancel,
    });
    const isDecisionPhase = session.phase === 'NOMINATION' || session.phase === 'SELECTION';
    return (
        <header className={styles.header}>
            <div className={styles.headingCopy}>
                <h1 ref={headingRef} tabIndex={-1}>
                    {movie && session.movieId ? (
                        <Link className={styles.filmLink} href={`/movies/${session.movieId}`}>
                            {movie.title ?? movie.originalTitle ?? 'Untitled film'}
                        </Link>
                    ) : (
                        getHeading(session)
                    )}
                </h1>
                <p className="visually-hidden">
                    Session · {SESSION_TYPES[session.type]} · {session.phase.toLowerCase()}
                </p>
                {movie ? <FilmMeta movie={movie} phase={session.phase} /> : null}
                {session.topic && isDecisionPhase ? (
                    <p className={styles.metaLine}>
                        <Icon name="bulb" />
                        {session.topic}
                    </p>
                ) : null}
                {session.notes && !movie ? (
                    <p className={styles.metaLine}>
                        <Icon name="document" />
                        <span className={styles.notes}>{session.notes}</span>
                    </p>
                ) : null}
                {session.deadlineAt && session.phase === 'NOMINATION' ? (
                    <p className={styles.deadline}>
                        <Icon name="clock" />
                        <NominationDeadline
                            deadlineAt={session.deadlineAt}
                            renderedAt={renderedAt}
                        />
                    </p>
                ) : null}
            </div>
            <div className={styles.headerActions}>
                <SessionLink sessionId={session.id} compact />
                {items.length ? (
                    <FilmStripMenu
                        triggerLabel="Session settings"
                        triggerIcon="settings"
                        menuLabel="Session actions"
                        items={items}
                    />
                ) : null}
                {participation}
            </div>
        </header>
    );
}

function getMenuItems(
    session: TSession,
    actions: {
        onKick?: () => void;
        onClosePhase?: () => void;
        closePhaseLabel: string;
        onEdit: () => void;
        onCancel: () => void;
    },
) {
    const items: IFilmStripMenuProps['items'] = [];
    if (actions.onClosePhase)
        items.push({
            id: 'next-phase',
            label: actions.closePhaseLabel,
            icon: 'chevron-right',
            onSelect: actions.onClosePhase,
        });
    if (session.canEdit)
        items.push({ id: 'edit', label: 'Edit Session', icon: 'edit', onSelect: actions.onEdit });
    if (actions.onKick)
        items.push({ id: 'kick', label: 'Kick', icon: 'user-x', onSelect: actions.onKick });
    if (session.canCancel)
        items.push({
            id: 'cancel',
            label: 'Cancel Session',
            icon: 'cancel',
            onSelect: actions.onCancel,
        });
    return items;
}

function getHeading(session: TSession) {
    if (session.phase === 'NOMINATION') return 'Movie Nomination';
    if (session.phase === 'SELECTION') return 'Movie Selection';
    return session.topic ?? 'Untitled Session';
}

const SESSION_TYPES = {
    FULL_CYCLE: 'Full cycle',
    PRE_SELECTED: 'Pre-selected Movie',
    PAST: 'Past screening',
} as const;

function FilmMeta({ movie, phase }: { movie: TMovieDetails; phase: TSession['phase'] }) {
    const facts = [movie.releaseYear, formatRuntime(movie.runtime)].filter(Boolean);
    return (
        <>
            {facts.length ? <p>{facts.join(' · ')}</p> : null}
            <div className={styles.filmChips}>
                {movie.genres?.slice(0, MAX_GENRES).map((genre) => (
                    <span className={styles.genreChip} key={genre}>
                        {genre}
                    </span>
                ))}
                <span className={styles.phaseStamp} data-live={phase === 'WATCHING' || undefined}>
                    {phase.toLowerCase()}
                </span>
            </div>
        </>
    );
}

function formatRuntime(minutes: number | null) {
    if (!minutes) return null;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    return hours ? `${hours}h ${minutes % MINUTES_PER_HOUR}m` : `${minutes}m`;
}

const MAX_GENRES = 3;
const MINUTES_PER_HOUR = 60;
