'use client';

import type { ISessionRoster } from '@pickflick/contracts';
import { type ReactNode, useRef, useState } from 'react';

import { changeRosterAction } from '#components/sessions/roster-actions';
import Button from '#components/ui/Button/Button';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Icon from '#components/ui/Icon/Icon';
import { useActionStatus } from '#lib/use-action-status';

import KickDialog from './KickDialog';
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
    const [isKickOpen, setIsKickOpen] = useState(false);
    const [dialog, setDialog] = useState<TRosterDialog | null>(null);
    const { message, isSuccess, setMessage, announceSuccess, isPending, run } = useActionStatus();
    const managed = roster.participants.filter(
        (participant) =>
            participant.canRemove ||
            (roster.canManage && participant.invitation?.state === 'pending'),
    );
    function send(input: unknown) {
        run(() => changeRosterAction(sessionId, input), {
            unreachableMessage: 'We could not reach PickFlick. Check your connection and retry.',
            onResult: (result) => {
                if (result.ok) announceSuccess(result.message);
                else setMessage(result.message);
                if (result.ok) {
                    if (dialog) restoreFocusRef.current = true;
                    setDialog(null);
                }
            },
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
                    onJoin={() => send({ action: 'join' })}
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
                isSuccess={isSuccess}
                isConfirming={dialog !== null}
                closeRef={closeRef}
                onClose={() => setIsKickOpen(false)}
                onRevoke={(inviteId) => send({ action: 'revoke', inviteId })}
                onRemove={(participant) =>
                    confirm({
                        action: 'remove',
                        name: participant.displayName,
                        participantId: participant.id,
                    })
                }
            />
            <ConfirmDialog
                cancelLabel={copy.cancelLabel}
                confirmLabel={copy.confirmLabel}
                inputId="session-roster-confirmation"
                onClose={() => setDialog(null)}
                onConfirm={(confirmation) =>
                    send(
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
                isPending={isPending}
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

type TRosterDialog =
    | { action: 'leave' }
    | { action: 'remove'; participantId: string; name: string };

function getConfirmationCopy(dialog: TRosterDialog | null) {
    if (dialog?.action === 'remove') {
        return {
            title: 'Remove participant',
            word: 'REMOVE',
            confirmLabel: 'Confirm removal',
            cancelLabel: 'Cancel',
            body: `Remove ${dialog.name}? This participant will no longer count toward Session progress. Their existing history stays.`,
        };
    }
    return {
        title: 'Leave Session',
        word: 'LEAVE',
        confirmLabel: 'Confirm leaving',
        cancelLabel: 'Keep participation',
        body: 'End your participation? You will no longer count toward Session progress. Your existing history stays.',
    };
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
            {roster.isRemoved ? (
                <p className={styles.removed}>
                    <Icon name="user-x" />
                    Removed
                    <span className="visually-hidden">
                        : an operator removed you from this Session.
                    </span>
                </p>
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
