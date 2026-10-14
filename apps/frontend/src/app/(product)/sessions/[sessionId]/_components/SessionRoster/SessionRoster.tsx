'use client';

import type { ISessionRoster } from '@pickflick/contracts';
import { useRef, useState, useTransition } from 'react';

import Button from '@/components/ui/Button/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';
import Select from '@/components/ui/Select/Select';
import TextInput from '@/components/ui/TextInput/TextInput';

import { changeRosterAction } from '../../roster-actions';
import styles from './SessionRoster.module.scss';

export default function SessionRoster({
    sessionId,
    initial,
}: {
    sessionId: string;
    initial: ISessionRoster;
}) {
    const roster = initial;
    const headingRef = useRef<HTMLHeadingElement>(null);
    const restoreFocusRef = useRef(false);
    const [memberId, setMemberId] = useState<string | null>(null);
    const [link, setLink] = useState('');
    const [message, setMessage] = useState('');
    const [dialog, setDialog] = useState<{
        action: 'leave' | 'remove';
        participantId?: string;
        name: string;
    } | null>(null);
    const [isPending, startTransition] = useTransition();
    function run(input: unknown) {
        if (!navigator.onLine) {
            setMessage('You appear to be offline. Reconnect before changing the roster.');
            return;
        }
        startTransition(async () => {
            try {
                const result = await changeRosterAction(sessionId, input);
                setMessage(result.message);
                if (result.ok) {
                    if (result.invitation)
                        setLink(
                            `${window.location.origin}/invite/session/${result.invitation.token}`,
                        );
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
        <section className={styles.roster} aria-label="Session participants">
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
                                {participant.invitation?.state === 'pending' && roster.canManage ? (
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
            {roster.canInvite ? (
                <div className={styles.invite}>
                    <Select
                        id="session-invite-member"
                        label="Invite a Club member"
                        placeholder="Choose a member"
                        value={memberId}
                        onChange={setMemberId}
                        disabled={isPending}
                        data={roster.eligibleMembers.map((member) => ({
                            value: member.id,
                            label: member.displayName,
                        }))}
                    />
                    <Button
                        disabled={!memberId || isPending}
                        onClick={() => run({ action: 'invite', membershipId: memberId })}
                    >
                        Create Session invitation
                    </Button>
                    <p>
                        A new link expires after seven days and replaces any pending link for this
                        member.
                    </p>
                </div>
            ) : null}
            {link ? (
                <TextInput
                    id="session-invite-link"
                    label="Session invitation link"
                    hint="This link works only for the selected Club member. Copy it before leaving this page."
                    value={link}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                />
            ) : null}
            {roster.canLeave ? (
                <Button
                    disabled={isPending}
                    variant="secondary-danger"
                    onClick={() => confirm('leave', 'your participation')}
                >
                    Leave Session
                </Button>
            ) : null}
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
    );
}
