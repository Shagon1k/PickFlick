'use client';

import type { IClubSettings, IManagedInvitation } from '@pickflick/contracts';
import { useState } from 'react';

import Button from '@/components/ui/Button/Button';

import { loadInvitationsAction, manageInvitationsAction } from '../../invitation-actions';
import styles from '../../page.module.scss';

export default function InvitationCard({ projection }: { projection: IClubSettings }) {
    const [invitations, setInvitations] = useState<IManagedInvitation[]>([]);
    const [link, setLink] = useState('');
    const [createdId, setCreatedId] = useState('');
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState('');
    const allowed = projection.permissions.manageMembers;

    async function run(kind: 'create' | 'load', inviteId?: string) {
        setPending(true);
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
            if (result.created) {
                const created = result.created;
                if (!result.invitations) {
                    setInvitations((current) => [
                        { id: created.id, expiresAt: created.expiresAt, state: 'pending' },
                        ...current,
                    ]);
                }
                setLink(`${globalThis.location.origin}/invite/club/${result.created.token}`);
                setCreatedId(result.created.id);
                setMessage(
                    [
                        'Invitation created. Share this link with one person; it expires in seven days.',
                        result.refreshError,
                    ]
                        .filter(Boolean)
                        .join(' '),
                );
            } else {
                if (inviteId === createdId) setLink('');
                setMessage(inviteId ? 'Invitation revoked.' : 'Recent invitations loaded.');
            }
        } catch {
            setMessage('Invitations could not be updated. Check your connection and try again.');
        } finally {
            setPending(false);
        }
    }

    async function copy() {
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
            <p>Each link can be accepted or declined once. Only registered users can join.</p>
            {projection.members.length >= projection.entitlements.memberLimit ? (
                <p>
                    The member limit is reached. A seat must become available before creating
                    another invitation.
                </p>
            ) : null}
            {!allowed ? (
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
                                    pending ||
                                    projection.members.length >= projection.entitlements.memberLimit
                                }
                                onClick={() => run('create')}
                            >
                                Create invitation
                            </Button>
                        ) : null}
                        <Button disabled={pending} onClick={() => run('load')} variant="secondary">
                            Recent invitations
                        </Button>
                    </div>
                    {link ? (
                        <div className={styles.invitationLink}>
                            <label htmlFor="invitation-link">Invitation link</label>
                            <input id="invitation-link" readOnly value={link} />
                            <Button disabled={pending} onClick={copy} variant="secondary">
                                Copy link
                            </Button>
                        </div>
                    ) : null}
                    <ul className={styles.invitationList}>
                        {invitations.map((invite) => (
                            <li key={invite.id}>
                                <span>
                                    {invite.state} · expires {invite.expiresAt.slice(0, 10)}
                                </span>
                                {invite.state === 'pending' ? (
                                    <Button
                                        disabled={pending}
                                        onClick={() => run('create', invite.id)}
                                        variant="secondary-danger"
                                    >
                                        Revoke invitation
                                    </Button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <p role="status">{message}</p>
        </section>
    );
}
