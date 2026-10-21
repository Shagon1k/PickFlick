'use client';

import type { ISessionRoster } from '@pickflick/contracts';
import { type ReactNode, useRef, useState, useTransition } from 'react';

import Button from '#components/ui/Button/Button';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { getOfflineMessage } from '#lib/offline';

import { changeRosterAction } from '../../roster-actions';
import styles from './SessionRoster.module.scss';

export default function SessionRoster({
    sessionId,
    initial,
    children,
}: {
    sessionId: string;
    initial: ISessionRoster;
    children: (participation: ReactNode) => ReactNode;
}) {
    const roster = initial;
    const headingRef = useRef<HTMLHeadingElement>(null);
    const restoreFocusRef = useRef(false);
    const [message, setMessage] = useState('');
    const [dialog, setDialog] = useState<{
        action: 'leave' | 'remove';
        participantId?: string;
        name: string;
    } | null>(null);
    const [isPending, startTransition] = useTransition();
    function run(input: unknown) {
        const offlineMessage = getOfflineMessage();
        if (offlineMessage) {
            setMessage(offlineMessage);
            return;
        }
        startTransition(async () => {
            try {
                const result = await changeRosterAction(sessionId, input);
                setMessage(result.message);
                if (result.ok) {
                    if (dialog) restoreFocusRef.current = true;
                    setDialog(null);
                }
            } catch {
                setMessage('We could not reach PickFlick. Check your connection and retry.');
            }
        });
    }
    function confirm(action: 'leave' | 'remove', name: string, participantId?: string) {
        setMessage('');
        setDialog({ action, name, participantId });
    }
    return (
        <>
            {children(
                <>
                    {roster.canJoin ? (
                        <Button disabled={isPending} onClick={() => run({ action: 'join' })}>
                            Join Session
                        </Button>
                    ) : null}
                    {roster.canLeave ? (
                        <Button
                            disabled={isPending}
                            variant="secondary-danger"
                            aria-label="Leave Session"
                            onClick={() => confirm('leave', 'your participation')}
                        >
                            Leave
                        </Button>
                    ) : null}
                </>,
            )}
            <section
                id="session-participants"
                className={styles.roster}
                aria-label="Session participants"
            >
                <header className={styles.header}>
                    <h2 ref={headingRef} tabIndex={-1}>
                        Participants
                    </h2>
                    <p>{roster.acceptedCount} accepted</p>
                </header>
                <p>Only accepted participants count toward this Session’s progress.</p>
                {roster.participants.length === 0 ? (
                    <p>No participants yet.</p>
                ) : (
                    <ul className={styles.list}>
                        {roster.participants.map((participant) => (
                            <li className={styles.row} key={participant.id}>
                                <div>
                                    <strong>{participant.displayName}</strong>
                                    <p>
                                        {participant.status.toLowerCase()}
                                        {participant.status === 'INVITED' && participant.invitation
                                            ? ` · invitation ${participant.invitation.state}`
                                            : ''}
                                    </p>
                                </div>
                                <div className={styles.actions}>
                                    {participant.invitation?.state === 'pending' &&
                                    roster.canManage ? (
                                        <Button
                                            disabled={isPending}
                                            variant="secondary"
                                            onClick={() =>
                                                run({
                                                    action: 'revoke',
                                                    inviteId: participant.invitation?.id,
                                                })
                                            }
                                        >
                                            Revoke invite for {participant.displayName}
                                        </Button>
                                    ) : null}
                                    {participant.canRemove ? (
                                        <Button
                                            disabled={isPending}
                                            variant="secondary-danger"
                                            onClick={() =>
                                                confirm(
                                                    'remove',
                                                    participant.displayName,
                                                    participant.id,
                                                )
                                            }
                                        >
                                            Remove {participant.displayName}
                                        </Button>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <p aria-live="polite" role="status">
                    {message}
                </p>
                <ConfirmDialog
                    cancelLabel="Keep participation"
                    confirmLabel={`Confirm ${dialog?.action === 'leave' ? 'leaving' : 'removal'}`}
                    inputId="session-roster-confirmation"
                    onClose={() => setDialog(null)}
                    onConfirm={(confirmation) =>
                        run(
                            dialog?.action === 'leave'
                                ? { action: 'leave', confirmation }
                                : {
                                      action: 'remove',
                                      participantId: dialog?.participantId,
                                      confirmation,
                                  },
                        )
                    }
                    onExitTransitionEnd={() => {
                        if (restoreFocusRef.current) {
                            headingRef.current?.focus();
                            restoreFocusRef.current = false;
                        }
                    }}
                    open={dialog !== null}
                    pending={isPending}
                    status={
                        <p aria-live="polite" role="status">
                            {message}
                        </p>
                    }
                    title={dialog?.action === 'leave' ? 'Leave Session' : 'Remove participant'}
                    word={dialog?.action === 'leave' ? 'LEAVE' : 'REMOVE'}
                >
                    <p>
                        End {dialog?.name}? This participant will no longer count toward Session
                        progress. Their existing history stays.
                    </p>
                </ConfirmDialog>
            </section>
        </>
    );
}
