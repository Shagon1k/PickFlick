'use client';

import type { ISessionRoster, TSession } from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import SessionForm from '#components/sessions/SessionForm/SessionForm';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Modal from '#components/ui/Modal/Modal';
import { formatUtcDateTime, toIsoDate } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';

import { cancelSessionAction } from '../../actions';
import styles from '../../page.module.scss';
import Nomination from '../Nomination/Nomination';
import Selection from '../Selection/Selection';
import SelectionClose from '../SelectionClose/SelectionClose';
import SelectionOutcome from '../SelectionOutcome/SelectionOutcome';
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
    return (
        <main className={styles.main}>
            <Link href={`/clubs/${session.clubId}`}>← {session.clubName}</Link>
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Session · {SESSION_TYPES[session.type]}</p>
                    <h1 ref={headingRef} tabIndex={-1}>
                        {session.topic ?? 'Untitled Session'}
                    </h1>
                </div>
                <p className={styles.phase}>{session.phase.toLowerCase()}</p>
            </header>
            {session.nominations ? (
                <Nomination
                    sessionId={session.id}
                    phaseVersion={session.phaseVersion}
                    data={session.nominations}
                />
            ) : null}
            {session.selection ? (
                <>
                    <Selection sessionId={session.id} data={session.selection} />
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
            <section className={styles.card} aria-label="Session details">
                <dl className={styles.facts}>
                    <div>
                        <dt>Date</dt>
                        <dd>
                            {session.scheduledAt ? toIsoDate(session.scheduledAt) : 'Not scheduled'}
                        </dd>
                    </div>
                    <div>
                        <dt>Location</dt>
                        <dd>{session.location ?? 'Not set'}</dd>
                    </div>
                    {session.deadlineAt ? (
                        <div>
                            <dt>Nomination deadline</dt>
                            <dd>{formatUtcDateTime(session.deadlineAt)}</dd>
                        </div>
                    ) : null}
                </dl>
                {session.notes ? <p className={styles.notes}>{session.notes}</p> : null}
                {session.movieId ? (
                    <ButtonLink href={`/movies/${session.movieId}`}>View selected Movie</ButtonLink>
                ) : null}
                {session.phase === 'CANCELLED' ? (
                    <p role="status">This Session was cancelled. Its history is preserved.</p>
                ) : null}
                <div className={styles.actions}>
                    {session.canEdit ? (
                        <Button onClick={() => setDialog('edit')} variant="secondary">
                            Edit Session
                        </Button>
                    ) : null}
                    {session.canCancel ? (
                        <Button
                            onClick={() => {
                                setMessage('');
                                setDialog('cancel');
                            }}
                            variant="secondary-danger"
                        >
                            Cancel Session
                        </Button>
                    ) : null}
                </div>
            </section>
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

const SESSION_TYPES = {
    FULL_CYCLE: 'Full cycle',
    PRE_SELECTED: 'Pre-selected Movie',
    PAST: 'Past screening',
} as const;
