'use client';

import type { IClubSettings, ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';
import { useState } from 'react';

import Button from '#components/ui/Button/Button';
import { toIsoDate } from '#lib/format';

import { loadInvitationsAction, manageInvitationsAction } from '../../invitation-actions';
import styles from '../../page.module.scss';

const INVITATION_ID_LENGTH = 8;

export default function InvitationCard({ projection }: { projection: IClubSettings }) {
    const [invitations, setInvitations] = useState<IManagedInvitation[]>([]);
    const [link, setLink] = useState('');
    const [createdId, setCreatedId] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [message, setMessage] = useState('');
    const isAllowed = projection.permissions.manageMembers;
    const isMemberLimitReached = projection.members.length >= projection.entitlements.memberLimit;
    const hasReachedLinkLimit =
        invitations.filter((invite) => invite.state === 'pending').length >=
        projection.entitlements.memberLimit;

    async function run(kind: 'create' | 'load', inviteId?: string) {
        setIsPending(true);
        setMessage('Updating invitations…');
        try {
            const result =
                kind === 'load'
                    ? await loadInvitationsAction(projection.club.id)
                    : await manageInvitationsAction(projection.club.id, inviteId);
            if (!result.ok) {
                setMessage(result.message);
                return;
            }
            if (result.invitations) setInvitations(result.invitations);
            if (kind === 'load') setHasLoaded(true);
            if ('created' in result && result.created) {
                showCreated(result.created, Boolean(result.invitations), result.refreshError);
            } else {
                if (inviteId === createdId) setLink('');
                setMessage(inviteId ? 'Invitation revoked.' : 'Recent invitations loaded.');
            }
        } catch {
            setMessage('Invitations could not be updated. Check your connection and try again.');
        } finally {
            setIsPending(false);
        }
    }

    /** Shows the new link once; without a refreshed list, the new link joins the current one. */
    function showCreated(created: ICreatedInvitation, isListed: boolean, refreshError?: string) {
        if (!isListed) {
            setInvitations((current) => [
                { id: created.id, expiresAt: created.expiresAt, state: 'pending' },
                ...current,
            ]);
        }
        setLink(`${globalThis.location.origin}/invite/club/${created.token}`);
        setCreatedId(created.id);
        setMessage(
            ['Link ready. Share it with one person.', refreshError].filter(Boolean).join(' '),
        );
    }

    async function handleCopy() {
        try {
            await globalThis.navigator.clipboard.writeText(link);
            setMessage('Link copied.');
        } catch {
            setMessage('Copy is unavailable. Select and copy the invitation link below.');
        }
    }

    return (
        <section aria-labelledby="club-invitations-title" className={styles.card}>
            <h2 id="club-invitations-title">Invite to this Club</h2>
            <p>A single-use join link, valid for 12 hours.</p>
            {isMemberLimitReached ? (
                <p>The member limit is reached; a seat must free up before the next invitation.</p>
            ) : null}
            {!isAllowed ? (
                <p>Invitations require an active Club and an Admin or Moderator.</p>
            ) : (
                <>
                    {!projection.permissions.createInvitations ? (
                        <p>New invitations are paused. Existing links can still be revoked.</p>
                    ) : null}
                    {link ? (
                        <div className={styles.invitationLink}>
                            <label className="visually-hidden" htmlFor="invitation-link">
                                Invitation link
                            </label>
                            <div className={styles.invitationLinkRow}>
                                <input id="invitation-link" readOnly value={link} />
                                <Button
                                    aria-label="Copy link"
                                    disabled={isPending}
                                    onClick={handleCopy}
                                    size="small"
                                    variant="secondary"
                                >
                                    Copy
                                </Button>
                            </div>
                            <p>
                                Single use · expires in 12 hours ·{' '}
                                <button
                                    aria-label="Revoke current link"
                                    className={styles.textButton}
                                    disabled={isPending}
                                    onClick={() => run('create', createdId)}
                                    type="button"
                                >
                                    Revoke
                                </button>
                            </p>
                        </div>
                    ) : null}
                    {!link && projection.permissions.createInvitations ? (
                        <Button
                            disabled={isPending || hasReachedLinkLimit || isMemberLimitReached}
                            onClick={() => run('create')}
                            size="small"
                        >
                            Create invitation
                        </Button>
                    ) : null}
                    <details
                        className={styles.invitationManagement}
                        onToggle={(event) => {
                            if (event.currentTarget.open && !hasLoaded) void run('load');
                        }}
                    >
                        <summary>Manage links</summary>
                        <ul className={styles.invitationList}>
                            {invitations.map((invite) => (
                                <li key={invite.id}>
                                    <span>
                                        <strong title={invite.id}>
                                            Invitation {invite.id.slice(0, INVITATION_ID_LENGTH)}
                                        </strong>
                                        {' · '}
                                        {invite.state} · expires {toIsoDate(invite.expiresAt)}
                                        {invite.id === createdId ? ' · latest link' : ''}
                                    </span>
                                    {invite.state === 'pending' && invite.id !== createdId ? (
                                        <Button
                                            disabled={isPending}
                                            onClick={() => run('create', invite.id)}
                                            size="small"
                                            variant="secondary-danger"
                                        >
                                            Revoke invitation
                                        </Button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </details>
                </>
            )}
            <p role="status">{message}</p>
        </section>
    );
}
