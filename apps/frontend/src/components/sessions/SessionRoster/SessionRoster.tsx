'use client';

import type { ISessionRoster } from '@pickflick/contracts';
import { type ReactNode, type RefObject, useRef, useState, useTransition } from 'react';

import { changeRosterAction } from '#components/sessions/roster-actions';
import Button from '#components/ui/Button/Button';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Icon from '#components/ui/Icon/Icon';
import Modal from '#components/ui/Modal/Modal';
import { getMonogram } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';

import styles from './SessionRoster.module.scss';

/** Join/Leave for the header and, for operators, the gear menu's Kick dialog. */
export default function SessionRoster({
    sessionId,
    roster,
    children,
}: {
    sessionId: string;
    roster: ISessionRoster;
    children: (participation: ReactNode, onKick?: () => void) => ReactNode;
}) {
    const closeRef = useRef<HTMLButtonElement>(null);
    const restoreFocusRef = useRef(false);
    const [message, setMessage] = useState('');
    const [isKickOpen, setIsKickOpen] = useState(false);
    const [dialog, setDialog] = useState<TRosterDialog | null>(null);
    const [isPending, startTransition] = useTransition();
    const managed = roster.participants.filter(
        (participant) =>
            participant.canRemove ||
            (roster.canManage && participant.invitation?.state === 'pending'),
    );
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
    const copy = getConfirmationCopy(dialog);
    function confirm(next: TRosterDialog) {
        setMessage('');
        setDialog(next);
    }
    return (
        <>
            {children(
                <Participation
                    roster={roster}
                    disabled={isPending}
                    onJoin={() => run({ action: 'join' })}
                    onLeave={() => confirm({ action: 'leave' })}
                />,
                roster.canManage && managed.length
                    ? () => {
                          setMessage('');
                          setIsKickOpen(true);
                      }
                    : undefined,
            )}
            <p aria-live="polite" className="visually-hidden" role="status">
                {isKickOpen || dialog ? '' : message}
            </p>
            <KickDialog
                open={isKickOpen}
                participants={managed}
                canRevoke={roster.canManage}
                disabled={isPending}
                status={dialog ? '' : message}
                isConfirming={dialog !== null}
                closeRef={closeRef}
                onClose={() => setIsKickOpen(false)}
                onRevoke={(inviteId) => run({ action: 'revoke', inviteId })}
                onRemove={(participant) =>
                    confirm({
                        action: 'remove',
                        name: participant.displayName,
                        participantId: participant.id,
                    })
                }
            />
            <ConfirmDialog
                cancelLabel="Keep participation"
                confirmLabel={copy.confirmLabel}
                inputId="session-roster-confirmation"
                onClose={() => setDialog(null)}
                onConfirm={(confirmation) =>
                    run(
                        dialog?.action === 'remove'
                            ? {
                                  action: 'remove',
                                  participantId: dialog.participantId,
                                  confirmation,
                              }
                            : { action: 'leave', confirmation },
                    )
                }
                onExitTransitionEnd={() => {
                    // A removed row's button is gone, so focus lands on the Kick dialog's Close.
                    if (restoreFocusRef.current) {
                        closeRef.current?.focus();
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
                title={copy.title}
                word={copy.word}
            >
                <p>{copy.body}</p>
            </ConfirmDialog>
        </>
    );
}

type TParticipant = ISessionRoster['participants'][number];
type TRosterDialog =
    | { action: 'leave' }
    | { action: 'remove'; participantId: string; name: string };

function getConfirmationCopy(dialog: TRosterDialog | null) {
    if (dialog?.action === 'remove') {
        return {
            title: 'Remove participant',
            word: 'REMOVE',
            confirmLabel: 'Confirm removal',
            body: `Remove ${dialog.name}? This participant will no longer count toward Session progress. Their existing history stays.`,
        };
    }
    return {
        title: 'Leave Session',
        word: 'LEAVE',
        confirmLabel: 'Confirm leaving',
        body: 'End your participation? You will no longer count toward Session progress. Your existing history stays.',
    };
}

function KickDialog({
    open,
    participants,
    canRevoke,
    disabled,
    status,
    isConfirming,
    closeRef,
    onClose,
    onRevoke,
    onRemove,
}: {
    open: boolean;
    participants: TParticipant[];
    canRevoke: boolean;
    disabled: boolean;
    status: string;
    /** Escape then belongs to the confirmation stacked above, not to this list. */
    isConfirming: boolean;
    closeRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    onRevoke: (inviteId: string) => void;
    onRemove: (participant: TParticipant) => void;
}) {
    return (
        <Modal
            actions={
                <Button ref={closeRef} onClick={onClose} variant="secondary">
                    Close
                </Button>
            }
            dismissible={!isConfirming}
            onClose={onClose}
            open={open}
            title="Kick participants"
        >
            {participants.length ? (
                <ul className={styles.list}>
                    {participants.map((participant) => (
                        <KickRow
                            key={participant.id}
                            participant={participant}
                            canRevoke={canRevoke}
                            disabled={disabled}
                            onRevoke={onRevoke}
                            onRemove={() => onRemove(participant)}
                        />
                    ))}
                </ul>
            ) : (
                <p>No participants can be removed.</p>
            )}
            <p aria-live="polite" role="status">
                {open ? status : ''}
            </p>
        </Modal>
    );
}

function KickRow({
    participant,
    canRevoke,
    disabled,
    onRevoke,
    onRemove,
}: {
    participant: TParticipant;
    canRevoke: boolean;
    disabled: boolean;
    onRevoke: (inviteId: string) => void;
    onRemove: () => void;
}) {
    const { displayName, invitation, status } = participant;
    return (
        <li className={styles.row}>
            <span aria-hidden="true" className={styles.avatar}>
                {getMonogram(displayName)}
            </span>
            <span className={styles.name}>
                {displayName}
                <small>
                    {status.toLowerCase()}
                    {status === 'INVITED' && invitation ? ` · invitation ${invitation.state}` : ''}
                </small>
            </span>
            {invitation?.state === 'pending' && canRevoke ? (
                <Button
                    aria-label={`Revoke invite for ${displayName}`}
                    disabled={disabled}
                    onClick={() => onRevoke(invitation.id)}
                    size="small"
                    variant="secondary"
                >
                    Revoke
                </Button>
            ) : null}
            {participant.canRemove ? (
                <Button
                    aria-label={`Remove ${displayName}`}
                    disabled={disabled}
                    onClick={onRemove}
                    size="small"
                    variant="secondary-danger"
                >
                    Kick
                </Button>
            ) : null}
        </li>
    );
}

function Participation({
    roster,
    disabled,
    onJoin,
    onLeave,
}: {
    roster: ISessionRoster;
    disabled: boolean;
    onJoin: () => void;
    onLeave: () => void;
}) {
    return (
        <>
            {roster.canJoin ? (
                <Button
                    aria-label="Join Session"
                    disabled={disabled}
                    onClick={onJoin}
                    variant="cell"
                >
                    <Icon name="check" />
                    Join
                </Button>
            ) : null}
            {roster.canLeave ? (
                <Button
                    aria-label="Leave Session"
                    disabled={disabled}
                    onClick={onLeave}
                    variant="cell-danger"
                >
                    <Icon name="sign-out" />
                    Leave
                </Button>
            ) : null}
        </>
    );
}
