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
import SelectionClose from '#components/sessions/SelectionClose/SelectionClose';
import SessionForm from '#components/sessions/SessionForm/SessionForm';
import SessionRoster from '#components/sessions/SessionRoster/SessionRoster';
import Alert from '#components/ui/Alert/Alert';
import Modal from '#components/ui/Modal/Modal';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';

import styles from '../../page.module.scss';
import Nomination from '../Nomination/Nomination';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import Selection from '../Selection/Selection';
import SelectionOutcome from '../SelectionOutcome/SelectionOutcome';
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
            closePhaseLabel={
                session.phase === 'NOMINATION' ? 'Close nominations early' : 'Close Selection early'
            }
            headingRef={headingRef}
            onEdit={() => setDialog('edit')}
            onCancel={() => setDialog('cancel')}
        />
    );
    // The server sends Nomination or Selection data only in its own phase.
    function renderPhase(participation: ReactNode, onKick?: () => void) {
        if (isFilmSessionPhase(session.phase))
            return (
                <>
                    <PhaseProgress>
                        {roster.acceptedCount}{' '}
                        {roster.acceptedCount === 1 ? 'member has' : 'members have'} joined the
                        screening.
                    </PhaseProgress>
                    {header(participation, onKick)}
                    <ScreeningFilm movie={movie} movieId={session.movieId} />
                </>
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
                    canClose={session.canEdit && selection.nominations.length > 0}
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
                        {session.selectionOutcome ? (
                            <SelectionOutcome data={session.selectionOutcome} />
                        ) : null}
                        <div className={styles.reelBreak} aria-hidden="true">
                            <SprocketDivider variant="section" />
                            <Image src={getPhaseMascot(session.phase)} alt="" />
                        </div>
                        <h2 className={styles.detailsTitle}>Session Details</h2>
                        <SessionFacts session={session} roster={roster} />
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
