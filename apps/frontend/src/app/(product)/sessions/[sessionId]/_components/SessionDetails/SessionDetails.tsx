'use client';

import {
    type ISessionRoster,
    isFilmSessionPhase,
    type TMovieDetails,
    type TSession,
} from '@pickflick/contracts';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import CancelSessionDialog from '#components/sessions/CancelSessionDialog/CancelSessionDialog';
import NominationClose from '#components/sessions/NominationClose/NominationClose';
import OpenRating from '#components/sessions/OpenRating/OpenRating';
import RatingClose from '#components/sessions/RatingClose/RatingClose';
import SelectionClose from '#components/sessions/SelectionClose/SelectionClose';
import SessionForm from '#components/sessions/SessionForm/SessionForm';
import SessionRoster from '#components/sessions/SessionRoster/SessionRoster';
import SessionStatus from '#components/sessions/SessionStatus/SessionStatus';
import Alert from '#components/ui/Alert/Alert';
import Modal from '#components/ui/Modal/Modal';

import styles from '../../page.module.scss';
import Nomination from '../Nomination/Nomination';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import YourRating from '../Rating/YourRating';
import Selection from '../Selection/Selection';
import SessionHeader from '../SessionHeader/SessionHeader';
import DetailsSection from './DetailsSection';

export default function SessionDetails({
    session,
    roster,
    movie,
    renderedAt,
}: {
    session: TSession;
    roster: ISessionRoster;
    movie: TMovieDetails | null;
    renderedAt: number;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const phaseRef = useRef(session.phase);
    useEffect(() => {
        if (phaseRef.current !== session.phase) headingRef.current?.focus();
        phaseRef.current = session.phase;
    }, [session.phase]);
    const [dialog, setDialog] = useState<'edit' | 'cancel' | null>(null);
    const header = (participation: ReactNode, onKick?: () => void, onClosePhase?: () => void) => (
        <SessionHeader
            session={session}
            movie={movie}
            participation={participation}
            renderedAt={renderedAt}
            onKick={onKick}
            onClosePhase={onClosePhase}
            headingRef={headingRef}
            onEdit={() => setDialog('edit')}
            onCancel={() => setDialog('cancel')}
        />
    );
    function renderPhase(participation: ReactNode, onKick?: () => void) {
        if (session.phase === 'COMPLETED')
            return (
                <>
                    <PhaseProgress>
                        This session has ended. The results are available{' '}
                        <a href="#rating-heading">below</a>.
                    </PhaseProgress>
                    {header(participation)}
                    <ScreeningFilm movie={movie} session={session} />
                </>
            );
        const rating = session.rating;
        if (rating)
            return (
                <RatingClose
                    sessionId={session.id}
                    phaseVersion={session.phaseVersion}
                    data={rating}
                >
                    {(onClose) => (
                        <>
                            <PhaseProgress>
                                Rating in progress — {rating.submittedCount} of{' '}
                                {rating.acceptedCount} members have rated.
                                {rating.canSubmit ? (
                                    <>
                                        {' '}
                                        Please <a href="#your-rating-heading">rate</a>.
                                    </>
                                ) : null}
                            </PhaseProgress>
                            {header(participation, onKick, onClose)}
                            <ScreeningFilm movie={movie} session={session} />
                            <YourRating key={session.id} sessionId={session.id} data={rating} />
                        </>
                    )}
                </RatingClose>
            );
        if (isFilmSessionPhase(session.phase))
            return (
                <OpenRating
                    sessionId={session.id}
                    phaseVersion={session.phaseVersion}
                    canOpen={session.phase === 'WATCHING' && session.canManage}
                >
                    {(onOpen) => (
                        <>
                            <PhaseProgress>
                                {roster.acceptedCount} of {roster.memberCount} members have joined
                                the screening.
                            </PhaseProgress>
                            {header(participation, onKick, onOpen)}
                            <ScreeningFilm movie={movie} session={session} />
                        </>
                    )}
                </OpenRating>
            );
        const nominations = session.nominations;
        if (nominations)
            return (
                <NominationClose
                    sessionId={session.id}
                    phaseVersion={session.phaseVersion}
                    canClose={nominations.canClose}
                >
                    {(onClose) => (
                        <Nomination
                            header={header(participation, onKick, onClose)}
                            sessionId={session.id}
                            data={nominations}
                        />
                    )}
                </NominationClose>
            );
        const selection = session.selection;
        if (selection)
            return (
                <SelectionClose
                    sessionId={session.id}
                    phaseVersion={session.phaseVersion}
                    submittedCount={selection.submittedCount}
                    acceptedCount={selection.acceptedCount}
                    canClose={session.canManage && selection.nominations.length > 0}
                >
                    {(onClose) => (
                        <Selection
                            header={header(participation, onKick, onClose)}
                            sessionId={session.id}
                            data={selection}
                        />
                    )}
                </SelectionClose>
            );
        return header(participation, onKick);
    }
    return (
        <main className={styles.main}>
            <SessionRoster sessionId={session.id} roster={roster}>
                {(participation, onKick) => (
                    <>
                        {renderPhase(participation, onKick)}
                        <DetailsSection session={session} roster={roster} />
                    </>
                )}
            </SessionRoster>
            <Modal open={dialog === 'edit'} title="Edit Session" onClose={() => setDialog(null)}>
                {dialog === 'edit' ? (
                    <SessionForm
                        clubId={session.clubId}
                        session={session}
                        onCancel={() => setDialog(null)}
                        onSaved={() => setDialog(null)}
                    />
                ) : null}
            </Modal>
            <CancelSessionDialog
                onClose={() => setDialog(null)}
                open={dialog === 'cancel'}
                session={session}
            />
        </main>
    );
}

function ScreeningFilm({ movie, session }: { movie: TMovieDetails | null; session: TSession }) {
    const movieId = session.movieId;
    if (movie)
        return (
            <div className={styles.film}>
                <MovieMedia
                    variant="session"
                    filmHref={movieId ? `/movies/${movieId}` : undefined}
                    shouldHidePhonePoster
                    movie={movie}
                    posterCorner={
                        <SessionStatus
                            phase={session.phase}
                            isLogged={session.type === 'PAST'}
                            placement="poster"
                        />
                    }
                    title={movie.title ?? movie.originalTitle ?? 'Untitled film'}
                />
            </div>
        );
    return (
        <Alert tone="warning">
            Film details are unavailable right now. The Session itself is unaffected.{' '}
            {movieId ? <Link href={`/movies/${movieId}`}>View selected Movie</Link> : null}
        </Alert>
    );
}
