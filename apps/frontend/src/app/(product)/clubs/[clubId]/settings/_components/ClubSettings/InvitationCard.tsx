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
    const [message, setMessage] = useState('');
    const isAllowed = projection.permissions.manageMembers;
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
            [
                'Invitation created. Share this link with one person; it expires in 12 hours.',
                refreshError,
            ]
                .filter(Boolean)
                .join(' '),
        );
    }

    async function handleCopy() {
        try {
            await globalThis.navigator.clipboard.writeText(link);
            setMessage('Invitation link copied.');
        } catch {
            setMessage('Copy is unavailable. Select and copy the invitation link below.');
        }
    }

    return (
        <section aria-labelledby="club-invitations-title" className={styles.card}>
            <h2 id="club-invitations-title">Invite to this Club</h2>
            <p>Generate a single-use join link, valid for 12 hours.</p>
            {projection.members.length >= projection.entitlements.memberLimit ? (
                <p>
                    The member limit is reached. A seat must become available before creating
                    another invitation.
                </p>
            ) : null}
            {!isAllowed ? (
                <p>Invitations require an active Club and an Admin or Moderator.</p>
            ) : (
                <>
                    {!projection.permissions.createInvitations ? (
                        <p>
                            New invitations are paused. You can still inspect and revoke existing
                            links.
                        </p>
                    ) : null}
                    <div className={styles.invitationActions}>
                        {projection.permissions.createInvitations ? (
                            <Button
                                disabled={
                                    isPending ||
                                    hasReachedLinkLimit ||
                                    projection.members.length >= projection.entitlements.memberLimit
                                }
                                onClick={() => run('create')}
                            >
                                Create invitation
                            </Button>
                        ) : null}
                    </div>
                    {link ? (
                        <div className={styles.invitationLink}>
                            <label htmlFor="invitation-link">Invitation link</label>
                            <input id="invitation-link" readOnly value={link} />
                            <Button disabled={isPending} onClick={handleCopy} variant="secondary">
                                Copy link
                            </Button>
                            <Button
                                disabled={isPending}
                                onClick={() => run('create', createdId)}
                                variant="secondary-danger"
                            >
                                Revoke current link
                            </Button>
                        </div>
                    ) : null}
                    <details
                        className={styles.invitationManagement}
                        open={!projection.permissions.createInvitations}
                    >
                        <summary>Manage links</summary>
                        <Button
                            disabled={isPending}
                            onClick={() => run('load')}
                            variant="secondary"
                        >
                            Recent invitations
                        </Button>
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
