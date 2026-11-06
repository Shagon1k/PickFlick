import { isFilmSessionPhase, isOpenSessionPhase, type TSession } from '@pickflick/contracts';
import clsx from 'clsx';

import ticket from '#components/movies/film-ticket.module.scss';
import FilmRailSkeleton from '#components/movies/FilmRailSkeleton/FilmRailSkeleton';
import TicketPoster from '#components/movies/TicketPoster/TicketPoster';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import page from '../../page.module.scss';
import styles from './SessionHeaderSkeleton.module.scss';

const OPEN_MANAGER_ACTION_COUNT = 3;
const OPEN_MEMBER_ACTION_COUNT = 2;
const SCORE_CELL_COUNT = 3;

export default function SessionHeaderSkeleton({ session }: { session?: TSession }) {
    const isFilm = Boolean(session?.movieId && isFilmSessionPhase(session.phase));
    const isDecision = session?.phase === 'NOMINATION' || session?.phase === 'SELECTION';
    const isCompleted = session?.phase === 'COMPLETED';
    const actions = getActionCount(session);
    const title = getTitle(session, isFilm);
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
                <HeaderMeta session={session} isFilm={isFilm} isDecision={isDecision} />
            </div>
            {isCompleted || actions ? (
                <div className={clsx(page.actionRail, ticket.rail, ticket.stub)}>
                    <FilmRailSkeleton
                        scores={isCompleted ? SCORE_CELL_COUNT : 0}
                        actions={isCompleted ? 0 : actions}
                    />
                </div>
            ) : null}
        </header>
    );
}

function getActionCount(session?: TSession) {
    if (!session) return 0;
    if (isOpenSessionPhase(session.phase))
        return session.canManage ? OPEN_MANAGER_ACTION_COUNT : OPEN_MEMBER_ACTION_COUNT;
    return session.canManage ? 1 : 0;
}
function getTitle(session: TSession | undefined, isFilm: boolean) {
    if (session?.phase === 'NOMINATION') return 'Movie Nomination';
    if (session?.phase === 'SELECTION') return 'Movie Selection';
    if (isFilm) return null;
    return session?.topic ?? 'Session';
}
function HeaderMeta({
    session,
    isFilm,
    isDecision,
}: {
    session?: TSession;
    isFilm: boolean;
    isDecision: boolean;
}) {
    return (
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
    );
}
