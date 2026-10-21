'use client';

import type { ISessionRoster, TSession } from '@pickflick/contracts';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState, useTransition } from 'react';

import nominationPanda from '#brand/panda-collection.webp';
import watchingPanda from '#brand/panda-rating.webp';
import selectionPanda from '#brand/panda-rating-2.webp';
import SessionForm from '#components/sessions/SessionForm/SessionForm';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Modal from '#components/ui/Modal/Modal';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { getOfflineMessage } from '#lib/offline';

import { cancelSessionAction } from '../../actions';
import styles from '../../page.module.scss';
import Nomination from '../Nomination/Nomination';
import Selection from '../Selection/Selection';
import SelectionClose from '../SelectionClose/SelectionClose';
import SelectionOutcome from '../SelectionOutcome/SelectionOutcome';
import SessionFacts from '../SessionFacts/SessionFacts';
import SessionHeader from '../SessionHeader/SessionHeader';
import SessionRoster from '../SessionRoster/SessionRoster';

export default function SessionDetails({
    session,
    roster,
}: {
    session: TSession;
    roster: ISessionRoster;
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
    const header = (participation: ReactNode, onClosePhase?: () => void) => (
        <SessionHeader
            session={session}
            participation={participation}
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
                {(participation) => (
                    <>
                        {!session.nominations && !session.selection ? header(participation) : null}
                        {session.nominations ? (
                            <Nomination
                                header={(onClose) => header(participation, onClose)}
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
                                        header={header(participation, onClose)}
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

function getPhaseMascot(phase: TSession['phase']) {
    if (phase === 'NOMINATION') return nominationPanda;
    if (phase === 'SELECTION') return selectionPanda;
    return watchingPanda;
}
