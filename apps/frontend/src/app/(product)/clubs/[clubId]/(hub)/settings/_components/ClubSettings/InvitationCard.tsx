'use client';

import type { IClubSettings, ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';
import { useState } from 'react';

import Button from '#components/ui/Button/Button';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import Modal from '#components/ui/Modal/Modal';
import { toIsoDate } from '#lib/format';

import {
    createInvitationAction,
    loadInvitationsAction,
    revokeInvitationAction,
    type TInvitationResult,
} from '../../invitation-actions';
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
    const isMemberLimitReached = projection.access.isAtCapacity;
    const hasReachedLinkLimit =
        invitations.filter((invite) => invite.state === 'pending').length >=
        projection.entitlements.memberLimit;

    async function perform(
        request: () => Promise<TInvitationResult>,
        onDone: (result: Extract<TInvitationResult, { ok: true }>) => void,
    ) {
        setIsPending(true);
        setMessage('Updating invitations…');
        try {
            const result = await request();
            if (!result.ok) {
                setMessage(result.message);
                return;
            }
            if (result.invitations) setInvitations(result.invitations);
            onDone(result);
        } catch {
            setMessage('Invitations could not be updated. Check your connection and try again.');
        } finally {
            setIsPending(false);
        }
    }

    function handleLoad() {
        void perform(
            () => loadInvitationsAction(projection.club.id),
            () => {
                setHasLoaded(true);
                setMessage('Recent invitations loaded.');
            },
        );
    }

    function handleCreate() {
        void perform(
            () => createInvitationAction(projection.club.id),
            (result) => {
                if (result.created)
                    showCreated(result.created, Boolean(result.invitations), result.refreshError);
            },
        );
    }

    function handleRevoke(inviteId: string) {
        void perform(
            () => revokeInvitationAction(projection.club.id, inviteId),
            ({ invitations: refreshed, refreshError }) => {
                if (!refreshed) {
                    setInvitations((current) =>
                        current.map((invite) =>
                            invite.id === inviteId ? { ...invite, state: 'revoked' } : invite,
                        ),
                    );
                }
                if (inviteId === createdId) setLink('');
                setMessage(['Invitation revoked.', refreshError].filter(Boolean).join(' '));
            },
        );
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
        if (!hasLoaded) handleLoad();
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
                {projection.permissions.createInvitations || isMemberLimitReached ? null : (
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
                                onClick={() => handleRevoke(createdId)}
                                type="button"
                            >
                                Revoke
                            </button>
                        </p>
                    </div>
                ) : null}
                {/* A full Club keeps the button visible but disabled, next to its explanation. */}
                {!link && (projection.permissions.createInvitations || isMemberLimitReached) ? (
                    <Button
                        disabled={isPending || hasReachedLinkLimit || isMemberLimitReached}
                        onClick={handleCreate}
                    >
                        Create invitation
                    </Button>
                ) : null}
                <InvitationList
                    createdId={createdId}
                    disabled={isPending}
                    invitations={invitations}
                    onRevoke={handleRevoke}
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
                                aria-label={`Revoke invitation ${invite.id.slice(0, INVITATION_ID_LENGTH)}`}
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
