'use client';

import type { ISessionRoster, TSession } from '@pickflick/contracts';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import nominationPanda from '#brand/panda-collection.webp';
import selectionPanda from '#brand/panda-poll-master.webp';
import SessionForm from '#components/sessions/SessionForm/SessionForm';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Modal from '#components/ui/Modal/Modal';
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
    const header = (
        <SessionHeader
            session={session}
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
            {!session.nominations && !session.selection ? header : null}
            {session.nominations ? (
                <Nomination
                    header={header}
                    sessionId={session.id}
                    phaseVersion={session.phaseVersion}
                    data={session.nominations}
                />
            ) : null}
            {session.selection ? (
                <>
                    <Selection header={header} sessionId={session.id} data={session.selection} />
                    <SelectionClose
                        sessionId={session.id}
                        phaseVersion={session.phaseVersion}
                        submittedCount={session.selection.submittedCount}
                        acceptedCount={session.selection.acceptedCount}
                        canClose={session.canEdit && session.selection.nominations.length > 0}
                    />
                </>
            ) : null}
            {session.selectionOutcome ? <SelectionOutcome data={session.selectionOutcome} /> : null}
            <div className={styles.reelBreak} aria-hidden="true">
                <Image
                    src={session.phase === 'SELECTION' ? selectionPanda : nominationPanda}
                    alt=""
                    width={REEL_IMAGE_WIDTH}
                />
            </div>
            <h2 className={styles.detailsTitle}>Session Details</h2>
            <SessionFacts session={session} roster={roster} />
            <SessionRoster sessionId={session.id} initial={roster} />
            <p aria-live="polite" role="status">
                {message}
            </p>
            <Modal open={dialog === 'edit'} title="Edit Session" onClose={() => setDialog(null)}>
                {dialog === 'edit' ? (
                    <SessionForm
                        clubId={session.clubId}
                        session={session}
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

const REEL_IMAGE_WIDTH = 210;
