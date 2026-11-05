import { isOpenSessionPhase, type TMovieDetails, type TSession } from '@pickflick/contracts';
import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode, RefObject } from 'react';

import ticket from '#components/movies/film-ticket.module.scss';
import FilmMeta from '#components/movies/FilmMeta/FilmMeta';
import TicketPoster from '#components/movies/TicketPoster/TicketPoster';
import SessionLink from '#components/sessions/SessionLink/SessionLink';
import SessionRatingSummary from '#components/sessions/SessionRatingSummary/SessionRatingSummary';
import SessionStatus from '#components/sessions/SessionStatus/SessionStatus';
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
    headingRef: RefObject<HTMLHeadingElement | null>;
    onEdit: () => void;
    onCancel: () => void;
}) {
    const items = getMenuItems(session, { onKick, onClosePhase, onEdit, onCancel });
    const isDecisionPhase = isDecision(session.phase);
    const title = movie?.title ?? movie?.originalTitle ?? 'Untitled film';
    const filmHref = movie && session.movieId ? `/movies/${session.movieId}` : null;
    return (
        <header
            className={clsx(styles.header, ticket.ticket)}
            data-film={filmHref ? true : undefined}
            data-completed={session.phase === 'COMPLETED' || undefined}
        >
            {filmHref ? (
                <TicketPoster href={filmHref} title={title} url={movie?.posterUrl ?? null} />
            ) : null}
            <div className={clsx(styles.headingCopy, ticket.copy)}>
                <div className={styles.headingLine}>
                    <h1 ref={headingRef} tabIndex={-1}>
                        {getHeading(session, filmHref, title)}
                    </h1>
                    {isDecisionPhase ? null : (
                        <span className={clsx(styles.phaseStamp, ticket.corner)}>
                            <SessionStatus
                                phase={session.phase}
                                isLogged={session.type === 'PAST'}
                            />
                        </span>
                    )}
                </div>
                <div className={styles.headingMeta}>
                    <p className="visually-hidden">
                        Session · {SESSION_TYPES[session.type]} · {session.phase.toLowerCase()}
                    </p>
                    {movie && !isDecisionPhase ? (
                        <FilmMeta className={styles.filmMeta} movie={movie} />
                    ) : null}
                    <SessionLines
                        session={session}
                        hasMovie={movie !== null}
                        renderedAt={renderedAt}
                    />
                </div>
            </div>
            {/* Cells appear only for actions this viewer has, so members see two and managers three. */}
            <div className={clsx(styles.actionRail, ticket.rail, ticket.stub)}>
                {session.phase === 'COMPLETED' ? (
                    <SessionRatingSummary
                        rating={session.rating}
                        movieRatings={movie?.ratings ?? []}
                    />
                ) : (
                    <>
                        {/* Joining closes with the Session, so its link is shared only while it is open. */}
                        {isOpenSessionPhase(session.phase) ? (
                            <SessionLink sessionId={session.id} />
                        ) : null}
                        {items.length ? (
                            <FilmStripMenu
                                triggerLabel="Session settings"
                                triggerIcon="settings"
                                triggerText="Settings"
                                menuLabel="Session actions"
                                items={items}
                            />
                        ) : null}
                        <div className={ticket.railCell}>{participation}</div>
                    </>
                )}
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
    return (
        <>
            {session.topic && isDecision(session.phase) ? (
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

/** Nomination and Selection decide the film; the header shows the film only after them. */
function isDecision(phase: TSession['phase']) {
    return phase === 'NOMINATION' || phase === 'SELECTION';
}

function getClosePhaseLabel(phase: TSession['phase']) {
    if (phase === 'RATING') return 'Close Rating early';
    if (phase === 'WATCHING') return 'Open Rating';
    if (phase === 'NOMINATION') return 'Close nominations early';
    return 'Close Selection early';
}

function getMenuItems(
    session: TSession,
    actions: {
        onKick?: () => void;
        onClosePhase?: () => void;
        onEdit: () => void;
        onCancel: () => void;
    },
) {
    const items: IFilmStripMenuProps['items'] = [];
    if (actions.onClosePhase)
        items.push({
            id: 'next-phase',
            label: getClosePhaseLabel(session.phase),
            icon: 'skip-forward',
            onSelect: actions.onClosePhase,
        });
    if (session.canManage)
        items.push({ id: 'edit', label: 'Edit Session', icon: 'edit', onSelect: actions.onEdit });
    if (actions.onKick)
        items.push({ id: 'kick', label: 'Kick', icon: 'user-x', onSelect: actions.onKick });
    // A Session with received ratings is history: it can be closed, not cancelled.
    if (session.canManage && !session.rating?.receivedCount)
        items.push({
            id: 'cancel',
            label: 'Cancel Session',
            icon: 'cancel',
            onSelect: actions.onCancel,
        });
    return items;
}

function getHeading(session: TSession, filmHref: string | null, title: string) {
    if (filmHref)
        return (
            <Link className={styles.filmLink} href={filmHref}>
                {title}
            </Link>
        );
    if (session.phase === 'NOMINATION') return <>Movie Nomination</>;
    if (session.phase === 'SELECTION') return <>Movie Selection</>;
    return <>{session.topic ?? 'Untitled Session'}</>;
}

const SESSION_TYPES = {
    FULL_CYCLE: 'Full cycle',
    PRE_SELECTED: 'Pre-selected Movie',
    PAST: 'Past screening',
} as const;
