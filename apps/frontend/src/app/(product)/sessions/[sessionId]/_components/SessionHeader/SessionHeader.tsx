import type { TMovieDetails, TSession } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode, RefObject } from 'react';

import FilmMeta from '#components/movies/FilmMeta/FilmMeta';
import MoviePoster from '#components/movies/MoviePoster/MoviePoster';
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
    const title = movie?.title ?? movie?.originalTitle ?? 'Untitled film';
    const filmHref = movie && session.movieId ? `/movies/${session.movieId}` : null;
    return (
        <header className={styles.header} data-film={filmHref ? true : undefined}>
            {/* Phones show the poster as the header's ticket; the title link stays the named way in. */}
            {filmHref ? (
                <Link
                    aria-hidden="true"
                    className={styles.ticketPoster}
                    href={filmHref}
                    tabIndex={-1}
                >
                    <MoviePoster url={movie?.posterUrl ?? null} title={title} />
                    <span className={styles.infoMark}>i</span>
                </Link>
            ) : null}
            <div className={styles.headingCopy}>
                <h1 ref={headingRef} tabIndex={-1}>
                    {filmHref ? (
                        <Link className={styles.filmLink} href={filmHref}>
                            {title}
                        </Link>
                    ) : (
                        getHeading(session)
                    )}
                </h1>
                <p className="visually-hidden">
                    Session · {SESSION_TYPES[session.type]} · {session.phase.toLowerCase()}
                </p>
                {movie && !isDecisionPhase ? (
                    <FilmMeta className={styles.filmMeta} movie={movie} />
                ) : null}
                <SessionLines session={session} hasMovie={movie !== null} renderedAt={renderedAt} />
            </div>
            {/* The phase stamp stays when film details are unavailable. */}
            {isDecisionPhase ? null : (
                <span
                    className={styles.phaseStamp}
                    data-live={session.phase === 'WATCHING' || undefined}
                >
                    {session.phase.toLowerCase()}
                </span>
            )}
            {/* Cells appear only for actions this viewer has, so members see two and managers three. */}
            <div className={styles.actionRail}>
                <SessionLink sessionId={session.id} cell />
                {items.length ? (
                    <FilmStripMenu
                        triggerLabel="Session settings"
                        triggerIcon="settings"
                        triggerText="Settings"
                        menuLabel="Session actions"
                        items={items}
                    />
                ) : null}
                <div className={styles.railCell}>{participation}</div>
            </div>
        </header>
    );
}

/** Topic, notes and the Nomination deadline under the heading. */
function SessionLines({
    session,
    hasMovie,
    renderedAt,
}: {
    session: TSession;
    hasMovie: boolean;
    renderedAt: number;
}) {
    const isDecisionPhase = session.phase === 'NOMINATION' || session.phase === 'SELECTION';
    return (
        <>
            {session.topic && isDecisionPhase ? (
                <p className={styles.metaLine}>
                    <Icon name="bulb" />
                    {session.topic}
                </p>
            ) : null}
            {session.notes && !hasMovie ? (
                <p className={styles.metaLine}>
                    <Icon name="document" />
                    <span className={styles.notes}>{session.notes}</span>
                </p>
            ) : null}
            {session.deadlineAt && session.phase === 'NOMINATION' ? (
                <p className={styles.deadline}>
                    <Icon name="clock" />
                    <NominationDeadline deadlineAt={session.deadlineAt} renderedAt={renderedAt} />
                </p>
            ) : null}
        </>
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
