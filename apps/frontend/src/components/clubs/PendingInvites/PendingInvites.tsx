'use client';

import type { TPendingInvitation } from '@pickflick/contracts';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { useProductOverlay } from '#components/shells/product-overlay';
import Button from '#components/ui/Button/Button';
import Popover from '#components/ui/Popover/Popover';
import { formatCount, formatUtcDate } from '#lib/format';

import { loadPendingInvitesAction, respondPendingInviteAction } from './actions';
import styles from './PendingInvites.module.scss';

export default function PendingInvites() {
    const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
    const isOpen = activeOverlay === 'invites';
    const triggerRef = useRef<HTMLButtonElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const [invitations, setInvitations] = useState<TPendingInvitation[]>([]);
    const [message, setMessage] = useState('Loading pending invites…');
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPending, startTransition] = useTransition();
    const id = useId();
    async function load() {
        try {
            const result = await loadPendingInvitesAction();
            if (result.invitations) {
                setInvitations(result.invitations);
                setIsLoaded(true);
                setMessage('');
            } else {
                setIsLoaded(false);
                setMessage(result.message ?? 'Pending invites are unavailable.');
            }
        } catch {
            setIsLoaded(false);
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
    const countLabel = formatCount(invitations.length, 'invitation');
    return (
        <div className={styles.widget}>
            <Popover
                id={id}
                variant="invites"
                label="Pending invites"
                onChange={() => closeOverlay()}
                open={isOpen}
                trigger={
                    <button
                        aria-controls={`${id}-dropdown`}
                        aria-expanded={isOpen}
                        aria-haspopup="dialog"
                        aria-label="Open pending invites"
                        className={styles.ticket}
                        data-product-overlay-control
                        ref={triggerRef}
                        onClick={() => (isOpen ? closeOverlay() : openInvites())}
                        type="button"
                    >
                        <svg aria-hidden="true" className={styles.shape} viewBox="0 0 184 64">
                            <defs>
                                <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="var(--surface-lit)" />
                                    <stop offset="48%" stopColor="var(--surface)" />
                                    <stop offset="100%" stopColor="var(--surface)" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M14 0 H116 C116 4 119.5 7 124 7 C128.5 7 132 4 132 0 H170 Q184 0 184 14 V50 Q184 64 170 64 H132 C132 60 128.5 57 124 57 C119.5 57 116 60 116 64 H14 Q0 64 0 50 V14 Q0 0 14 0 Z"
                                fill={`url(#${id}-base)`}
                            />
                            <path
                                d="M14 .5 H116 C116 4 119.5 7 124 7 C128.5 7 132 4 132 .5 H170 Q183.5 .5 183.5 14 V50 Q183.5 63.5 170 63.5 H132 C132 60 128.5 57 124 57 C119.5 57 116 60 116 63.5 H14 Q.5 63.5 .5 50 V14 Q.5 .5 14 .5 Z"
                                fill="none"
                                stroke="var(--ivory-muted)"
                            />
                        </svg>
                        <span className={styles.main}>
                            <small className={styles.kicker}>Pending</small>
                            <strong className={styles.title}>Invites</strong>
                            <small className={styles.meta}>Club · Session</small>
                        </span>
                        <span className={styles.stub}>
                            <strong>{isLoaded ? invitations.length : '—'}</strong>
                            <small>open</small>
                        </span>
                    </button>
                }
            >
                <div className={styles.header} ref={headerRef}>
                    <div>
                        <h2>Pending invites</h2>
                        <span>{isLoaded ? countLabel : 'Checking invitations…'}</span>
                    </div>
                    <button type="button" className={styles.close} onClick={() => closeOverlay()}>
                        Close
                    </button>
                </div>
                <p className={styles.feedback} aria-live="polite" role="status">
                    {message ||
                        (isLoaded && invitations.length === 0 ? 'No pending invitations.' : '')}
                </p>
                {!isLoaded ? (
                    <Button
                        disabled={isPending}
                        onClick={() => startTransition(load)}
                        variant="secondary"
                    >
                        Retry invites
                    </Button>
                ) : null}
                <ul className={styles.list}>
                    {invitations.map((invitation) => (
                        <li className={styles.row} key={invitation.id}>
                            <small className={styles.type}>
                                {invitation.kind === 'club' ? 'Club invite' : 'Session invite'}
                            </small>
                            <h3>
                                {invitation.kind === 'club'
                                    ? invitation.clubName
                                    : (invitation.topic ?? 'Untitled Session')}
                            </h3>
                            <p>{describeInvitation(invitation)}</p>
                            <div className={styles.actions}>
                                <Button
                                    disabled={isPending}
                                    onClick={() =>
                                        respond(invitation.id, 'decline', invitation.kind)
                                    }
                                    size="small"
                                    variant="secondary"
                                >
                                    Decline
                                </Button>
                                <Button
                                    disabled={isPending}
                                    size="small"
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

function describeInvitation(invitation: TPendingInvitation): string {
    if (invitation.kind === 'club')
        return `Invited by ${invitation.inviterName} · ${formatCount(invitation.memberCount, 'member')} · Expires ${formatUtcDate(invitation.expiresAt)}`;
    return invitation.scheduledAt
        ? `${invitation.clubName} · ${new Intl.DateTimeFormat('en', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
          }).format(new Date(invitation.scheduledAt))}`
        : invitation.clubName;
}
