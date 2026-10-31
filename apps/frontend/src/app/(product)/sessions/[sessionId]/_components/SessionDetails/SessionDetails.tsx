'use client';

import {
    type ISessionRoster,
    isFilmSessionPhase,
    type TMovieDetails,
    type TSession,
} from '@pickflick/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import nominationPanda from '#brand/panda-collection.webp';
import watchingPanda from '#brand/panda-rating.webp';
import selectionPanda from '#brand/panda-rating-2.webp';
import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import CancelSessionDialog from '#components/sessions/CancelSessionDialog/CancelSessionDialog';
import NominationClose from '#components/sessions/NominationClose/NominationClose';
import OpenRating from '#components/sessions/OpenRating/OpenRating';
import RatingClose from '#components/sessions/RatingClose/RatingClose';
import SelectionClose from '#components/sessions/SelectionClose/SelectionClose';
import SessionForm from '#components/sessions/SessionForm/SessionForm';
import SessionRoster from '#components/sessions/SessionRoster/SessionRoster';
import Alert from '#components/ui/Alert/Alert';
import Modal from '#components/ui/Modal/Modal';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { formatCount } from '#lib/format';

import styles from '../../page.module.scss';
import Completed from '../Completed/Completed';
import Nomination from '../Nomination/Nomination';
import NominationRivals from '../NominationRivals/NominationRivals';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import Rating from '../Rating/Rating';
import Selection from '../Selection/Selection';
import SessionFacts from '../SessionFacts/SessionFacts';
import SessionHeader from '../SessionHeader/SessionHeader';

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
            closePhaseLabel={getClosePhaseLabel(session.phase)}
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
                        {session.type === 'PAST' ? 'Imported past screening. ' : ''}
                        Session complete —{' '}
                        {formatCount(session.rating?.receivedCount ?? 0, 'rating')} received. This
                        screening record is closed.
                    </PhaseProgress>
                    {header(participation)}
                    <ScreeningFilm movie={movie} movieId={session.movieId} />
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
                                {rating.acceptedCount} participants have rated. Rating never blocks
                                the next Session.
                            </PhaseProgress>
                            {header(participation, onKick, onClose)}
                            <ScreeningFilm movie={movie} movieId={session.movieId} />
                            <Rating
                                key={session.phase}
                                sessionId={session.id}
                                data={rating}
                                isCompleted={false}
                            />
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
                                {roster.acceptedCount}{' '}
                                {roster.acceptedCount === 1 ? 'member has' : 'members have'} joined
                                the screening.
                            </PhaseProgress>
                            {header(participation, onKick, onOpen)}
                            <ScreeningFilm movie={movie} movieId={session.movieId} />
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
                        {session.selectionOutcome?.source === 'LIVE' &&
                        session.selectionOutcome.breakdown &&
                        session.phase !== 'COMPLETED' ? (
                            <NominationRivals
                                outcome={session.selectionOutcome}
                                breakdown={session.selectionOutcome.breakdown}
                            />
                        ) : null}
                        <div className={styles.reelBreak} aria-hidden="true">
                            <SprocketDivider variant="section" />
                            <Image src={getPhaseMascot(session.phase)} alt="" />
                        </div>
                        <h2 className={styles.detailsTitle}>Session Details</h2>
                        <SessionFacts session={session} roster={roster} />
                        {session.phase === 'COMPLETED' ? <Completed session={session} /> : null}
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

function ScreeningFilm({
    movie,
    movieId,
}: {
    movie: TMovieDetails | null;
    movieId: string | null;
}) {
    if (movie)
        return (
            <div className={styles.film}>
                <MovieMedia
                    filmHref={movieId ? `/movies/${movieId}` : undefined}
                    shouldHidePhonePoster
                    movie={movie}
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

function getPhaseMascot(phase: TSession['phase']) {
    if (phase === 'NOMINATION') return nominationPanda;
    if (phase === 'SELECTION') return selectionPanda;
    return watchingPanda;
}

function getClosePhaseLabel(phase: TSession['phase']) {
    if (phase === 'RATING') return 'Close Rating early';
    if (phase === 'WATCHING') return 'Open Rating';
    if (phase === 'NOMINATION') return 'Close nominations early';
    return 'Close Selection early';
}
