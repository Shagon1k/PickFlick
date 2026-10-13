'use client';

import type { TPendingInvitation } from '@pickflick/contracts';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { useProductOverlay } from '@/components/shells/product-overlay';
import Button from '@/components/ui/Button/Button';
import Popover from '@/components/ui/Popover/Popover';
import { formatUtcDate } from '@/lib/format';

import { loadPendingInvitesAction, respondPendingInviteAction } from './actions';
import styles from './PendingInvites.module.scss';

export default function PendingInvites() {
    const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
    const open = activeOverlay === 'invites';
    const triggerRef = useRef<HTMLButtonElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const [invitations, setInvitations] = useState<TPendingInvitation[]>([]);
    const [message, setMessage] = useState('Loading pending invites…');
    const [loaded, setLoaded] = useState(false);
    const [pending, startTransition] = useTransition();
    const id = useId();
    async function load() {
        try {
            const result = await loadPendingInvitesAction();
            if (result.invitations) {
                setInvitations(result.invitations);
                setLoaded(true);
                setMessage('');
            } else {
                setLoaded(false);
                setMessage(result.message ?? 'Pending invites are unavailable.');
            }
        } catch {
            setLoaded(false);
            setMessage('Pending invites could not be loaded. Check your connection and retry.');
        }
    }

    useEffect(() => {
        startTransition(load);
    }, []);
    function openInvites() {
        if (triggerRef.current) {
            toggleOverlay('invites', triggerRef.current);
            startTransition(load);
        }
    }
    function respond(
        invitationId: string,
        decision: 'accept' | 'decline',
        kind: 'club' | 'session',
    ) {
        headerRef.current
            ?.querySelector<HTMLButtonElement>('button')
            ?.focus({ preventScroll: true });
        startTransition(async () => {
            try {
                const result = await respondPendingInviteAction(invitationId, decision, kind);
                setMessage(result.message);
                if (result.resolved)
                    setInvitations((current) =>
                        current.filter(({ id: inviteId }) => inviteId !== invitationId),
                    );
            } catch {
                setMessage('The response could not be confirmed. Check your connection and retry.');
            }
        });
    }
    const countLabel = `${invitations.length} invitation${invitations.length === 1 ? '' : 's'}`;
    return (
        <div className={styles.widget}>
            <Popover
                id={id}
                label="Pending invites"
                onChange={() => closeOverlay()}
                open={open}
                trigger={
                    <button
                        aria-controls={`${id}-dropdown`}
                        aria-expanded={open}
                        aria-haspopup="dialog"
                        aria-label="Open pending invites"
                        className={styles.ticket}
                        data-product-overlay-control
                        ref={triggerRef}
                        onClick={() => (open ? closeOverlay() : openInvites())}
                        type="button"
                    >
                        <svg
                            aria-hidden="true"
                            className={styles.shape}
                            preserveAspectRatio="none"
                            viewBox="0 0 184 72"
                        >
                            <path d="M12 1H122C122 10 134 10 134 1H172Q183 1 183 12V60Q183 71 172 71H134C134 62 122 62 122 71H12Q1 71 1 60V12Q1 1 12 1Z" />
                        </svg>
                        <span>
                            <small>Pending</small>
                            <strong>Invites</strong>
                            <small>
                                {invitations.some((invitation) => invitation.kind === 'session')
                                    ? 'Club & Session invites'
                                    : 'Club invitations'}
                            </small>
                        </span>
                        <span className={styles.stub}>
                            <strong>{loaded ? invitations.length : '—'}</strong>
                            <small>open</small>
                        </span>
                    </button>
                }
            >
                <div className={styles.header} ref={headerRef}>
                    <h2>Pending invites</h2>
                    <Button onClick={() => closeOverlay()} size="small" variant="secondary">
                        Close
                    </Button>
                </div>
                <p aria-live="polite" role="status">
                    {message || (invitations.length === 0 ? 'No pending invitations.' : countLabel)}
                </p>
                {!loaded ? (
                    <Button
                        disabled={pending}
                        onClick={() => startTransition(load)}
                        variant="secondary"
                    >
                        Retry invites
                    </Button>
                ) : null}
                <ul className={styles.list}>
                    {invitations.map((invitation) => (
                        <li className={styles.row} key={invitation.id}>
                            <small>
                                {invitation.kind === 'club'
                                    ? 'Club invitation'
                                    : 'Session invitation'}
                            </small>
                            <h3>{invitation.clubName}</h3>
                            <p>
                                Invited by {invitation.inviterName} ·{' '}
                                {invitation.kind === 'club'
                                    ? `${invitation.memberCount} members`
                                    : (invitation.topic ?? 'Untitled Session')}
                            </p>
                            <p>Expires {formatUtcDate(invitation.expiresAt)}</p>
                            <div className={styles.actions}>
                                <Button
                                    disabled={pending}
                                    onClick={() =>
                                        respond(invitation.id, 'decline', invitation.kind)
                                    }
                                    variant="secondary"
                                >
                                    Decline
                                </Button>
                                <Button
                                    disabled={pending}
                                    onClick={() =>
                                        respond(invitation.id, 'accept', invitation.kind)
                                    }
                                >
                                    Accept
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </Popover>
        </div>
    );
}
