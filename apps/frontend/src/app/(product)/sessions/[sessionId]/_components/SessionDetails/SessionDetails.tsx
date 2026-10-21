'use client';

import type { ISessionRoster, TMovieDetails, TSession } from '@pickflick/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState, useTransition } from 'react';

import nominationPanda from '#brand/panda-collection.webp';
import watchingPanda from '#brand/panda-rating.webp';
import selectionPanda from '#brand/panda-rating-2.webp';
import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import SessionForm from '#components/sessions/SessionForm/SessionForm';
import Alert from '#components/ui/Alert/Alert';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Modal from '#components/ui/Modal/Modal';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { getOfflineMessage } from '#lib/offline';

import { cancelSessionAction } from '../../actions';
import styles from '../../page.module.scss';
import Nomination from '../Nomination/Nomination';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import Selection from '../Selection/Selection';
import SelectionClose from '../SelectionClose/SelectionClose';
import SelectionOutcome from '../SelectionOutcome/SelectionOutcome';
import SessionFacts from '../SessionFacts/SessionFacts';
import SessionHeader from '../SessionHeader/SessionHeader';
import SessionRoster from '../SessionRoster/SessionRoster';

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
    const router = useRouter();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const phaseRef = useRef(session.phase);
    useEffect(() => {
        if (phaseRef.current !== session.phase) headingRef.current?.focus();
        phaseRef.current = session.phase;
    }, [session.phase]);
    const [dialog, setDialog] = useState<'edit' | 'cancel' | null>(null);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
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
            onCancel={() => {
                setMessage('');
                setDialog('cancel');
            }}
        />
    );
    return (
        <main className={styles.main}>
            <SessionRoster sessionId={session.id} initial={roster}>
                {(participation, onKick) => (
                    <>
                        {isFilmPhase(session.phase) ? (
                            <>
                                <PhaseProgress>
                                    {roster.acceptedCount}{' '}
                                    {roster.acceptedCount === 1 ? 'member has' : 'members have'}{' '}
                                    joined the screening.
                                </PhaseProgress>
                                {header(participation, onKick)}
                                <ScreeningFilm movie={movie} movieId={session.movieId} />
                            </>
                        ) : null}
                        {!isFilmPhase(session.phase) && !session.nominations && !session.selection
                            ? header(participation, onKick)
                            : null}
                        {session.nominations ? (
                            <Nomination
                                header={(onClose) => header(participation, onKick, onClose)}
                                sessionId={session.id}
                                phaseVersion={session.phaseVersion}
                                data={session.nominations}
                            />
                        ) : null}
                        {session.selection ? (
                            <SelectionClose
                                sessionId={session.id}
                                phaseVersion={session.phaseVersion}
                                submittedCount={session.selection.submittedCount}
                                acceptedCount={session.selection.acceptedCount}
                                canClose={
                                    session.canEdit && session.selection.nominations.length > 0
                                }
                            >
                                {(onClose) => (
                                    <Selection
                                        header={header(participation, onKick, onClose)}
                                        sessionId={session.id}
                                        data={session.selection!}
                                    />
                                )}
                            </SelectionClose>
                        ) : null}
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
            <p aria-live="polite" role="status">
                {message}
            </p>
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
            <ConfirmDialog
                confirmLabel="Confirm cancellation"
                cancelLabel="Keep Session"
                inputId="cancel-confirmation"
                onClose={() => setDialog(null)}
                onConfirm={(confirmation) => {
                    const offlineMessage = getOfflineMessage();
                    if (offlineMessage) {
                        setMessage(offlineMessage);
                        return;
                    }
                    startTransition(async () => {
                        const result = await cancelSessionAction(session.id, {
                            version: session.version,
                            confirmation,
                        }).catch(() => ({
                            ok: false,
                            message: 'We could not reach PickFlick. Try again.',
                        }));
                        setMessage(result.message);
                        if (result.ok) {
                            setDialog(null);
                            router.refresh();
                        }
                    });
                }}
                open={dialog === 'cancel'}
                pending={isPending}
                status={
                    <p aria-live="polite" role="status">
                        {message}
                    </p>
                }
                title="Cancel Session"
                word="CANCEL"
            >
                <p>
                    Cancel “{session.topic ?? 'Untitled Session'}”? Participation ends and this Club
                    can schedule another Session. Existing history stays.
                </p>
            </ConfirmDialog>
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

function isFilmPhase(phase: TSession['phase']) {
    return phase === 'WATCHING' || phase === 'RATING' || phase === 'COMPLETED';
}

function getPhaseMascot(phase: TSession['phase']) {
    if (phase === 'NOMINATION') return nominationPanda;
    if (phase === 'SELECTION') return selectionPanda;
    return watchingPanda;
}
