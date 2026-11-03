import { isFilmSessionPhase, isOpenSessionPhase, type TSession } from '@pickflick/contracts';
import clsx from 'clsx';

import FilmRailSkeleton from '#components/movies/FilmRailSkeleton/FilmRailSkeleton';
import ticket from '#components/movies/film-ticket.module.scss';
import TicketPoster from '#components/movies/TicketPoster/TicketPoster';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import page from '../../page.module.scss';
import styles from './SessionHeaderSkeleton.module.scss';

export default function SessionHeaderSkeleton({ session }: { session?: TSession }) {
    const isFilm = Boolean(session?.movieId && isFilmSessionPhase(session.phase));
    const isDecision = session?.phase === 'NOMINATION' || session?.phase === 'SELECTION';
    const isCompleted = session?.phase === 'COMPLETED';
    const actions =
        session && isOpenSessionPhase(session.phase)
            ? session.canManage
                ? 3
                : 2
            : session?.canManage
              ? 1
              : 0;
    const title =
        session?.phase === 'NOMINATION'
            ? 'Movie Nomination'
            : session?.phase === 'SELECTION'
              ? 'Movie Selection'
              : !isFilm
                ? (session?.topic ?? 'Session')
                : null;
    return (
        <header
            className={clsx(page.header, ticket.ticket)}
            data-film={isFilm || undefined}
            data-completed={isCompleted || undefined}
        >
            {isFilm ? <TicketPoster isLoading title="" url={null} /> : null}
            <div className={clsx(page.headingCopy, ticket.copy)}>
                <div className={page.headingLine}>
                    <h1 className={title ? undefined : styles.unknownTitle}>
                        {title ? <Skeleton text={title} /> : <Skeleton shouldFill />}
                    </h1>
                    {session && !isDecision ? (
                        <span className={clsx(page.phaseStamp, ticket.corner)}>
                            <span className={styles.phase}>
                                <Skeleton shouldFill />
                            </span>
                        </span>
                    ) : null}
                </div>
                <div className={page.headingMeta}>
                    {isFilm ? (
                        <div className={styles.filmMeta}>
                            <Skeleton width="half" />
                        </div>
                    ) : null}
                    {session?.topic && isDecision ? (
                        <p className={page.metaLine}>
                            <Skeleton text={session.topic} />
                        </p>
                    ) : null}
                    {session?.notes && !isFilm ? (
                        <p className={page.metaLine}>
                            <Skeleton text={session.notes} />
                        </p>
                    ) : null}
                    {session?.deadlineAt && session.phase === 'NOMINATION' ? (
                        <p className={page.deadline}>
                            <Skeleton width="half" />
                        </p>
                    ) : null}
                </div>
            </div>
            {isCompleted || actions ? (
                <div className={clsx(page.actionRail, ticket.rail, ticket.stub)}>
                    <FilmRailSkeleton
                        scores={isCompleted ? 3 : 0}
                        actions={isCompleted ? 0 : actions}
                    />
                </div>
            ) : null}
        </header>
    );
}
