'use client';

import type { IClubSettings, ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';
import { useState } from 'react';

import Button from '#components/ui/Button/Button';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import Modal from '#components/ui/Modal/Modal';
import { toIsoDate } from '#lib/format';

import { loadInvitationsAction, manageInvitationsAction } from '../../invitation-actions';
import styles from '../../page.module.scss';
import ManageModerators from './ManageModerators';

const INVITATION_ID_LENGTH = 8;

/** The Members card: invitation links live in a dialog so the card stays one row of actions. */
export default function InvitationCard({ projection }: { projection: IClubSettings }) {
    const [isOpen, setIsOpen] = useState(false);
    const [invitations, setInvitations] = useState<IManagedInvitation[]>([]);
    const [link, setLink] = useState('');
    const [createdId, setCreatedId] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [message, setMessage] = useState('');
    const isAllowed = projection.permissions.manageMembers;
    const canManageRoles =
        projection.club.membershipRole === 'ADMIN' && projection.club.lifecycle === 'ACTIVE';
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

    function handleOpen() {
        setIsOpen(true);
        if (!hasLoaded) void run('load');
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
        <section aria-labelledby="club-members-title" className={styles.card}>
            <div className={styles.cardTitle}>
                <h2 id="club-members-title">Members</h2>
                <InfoTip label="About invitations">
                    Each invitation link admits one person and expires after 12 hours.
                </InfoTip>
            </div>
            <p className={styles.cardLead}>
                {projection.members.length} of {projection.entitlements.memberLimit} member places
                in use.
                {isAllowed ? null : ' Invitations need an active Club and an Admin or Moderator.'}
            </p>
            {isAllowed || canManageRoles ? (
                <div className={styles.cardActions}>
                    {isAllowed ? (
                        <Button onClick={handleOpen} size="small">
                            Invite members
                        </Button>
                    ) : null}
                    {canManageRoles ? <ManageModerators projection={projection} /> : null}
                </div>
            ) : null}
            <Modal
                actions={
                    <Button onClick={() => setIsOpen(false)} variant="secondary">
                        Close
                    </Button>
                }
                onClose={() => setIsOpen(false)}
                open={isOpen}
                title="Invite to this Club"
            >
                <p className={styles.explanation}>A single-use join link, valid for 12 hours.</p>
                {isMemberLimitReached ? (
                    <p>
                        The member limit is reached; a seat must free up before the next invitation.
                    </p>
                ) : null}
                {projection.permissions.createInvitations ? null : (
                    <p>New invitations are paused. Existing links can still be revoked.</p>
                )}
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
                    >
                        Create invitation
                    </Button>
                ) : null}
                <InvitationList
                    createdId={createdId}
                    disabled={isPending}
                    invitations={invitations}
                    onRevoke={(inviteId) => run('create', inviteId)}
                />
                <p className={styles.invitationStatus} role="status">
                    {message}
                </p>
            </Modal>
        </section>
    );
}

function InvitationList({
    invitations,
    createdId,
    disabled,
    onRevoke,
}: {
    invitations: IManagedInvitation[];
    createdId: string;
    disabled: boolean;
    onRevoke: (inviteId: string) => void;
}) {
    if (!invitations.length) return null;
    return (
        <>
            <h3 className={styles.invitationListTitle}>Recent links</h3>
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
                            <button
                                aria-label="Revoke invitation"
                                className={styles.textButton}
                                disabled={disabled}
                                onClick={() => onRevoke(invite.id)}
                                type="button"
                            >
                                Revoke
                            </button>
                        ) : null}
                    </li>
                ))}
            </ul>
        </>
    );
}
