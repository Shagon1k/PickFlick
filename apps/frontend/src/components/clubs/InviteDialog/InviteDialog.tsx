'use client';

import {
    CLUB_INVITATION_LIFETIME_HOURS,
    type IClubSettings,
    type ICreatedInvitation,
    type IManagedInvitation,
} from '@pickflick/contracts';
import { type ReactNode, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import Modal from '#components/ui/Modal/Modal';
import { toIsoDate } from '#lib/format';

import {
    createInvitationAction,
    loadInvitationsAction,
    revokeInvitationAction,
    type TInvitationResult,
} from './invitation-actions';
import styles from './InviteDialog.module.scss';

const INVITATION_ID_LENGTH = 8;
const COPIED_ICON_MS = 1500;

/**
 * Opening the dialog tears off a fresh single-use link as a ticket with Copy on its stub; older
 * links fold under one row. A new link appears once per page view, not on every reopening.
 */
export default function InviteDialog({
    projection,
    trigger,
}: {
    projection: IClubSettings;
    /** The control that opens the dialog, given the opener. */
    trigger: (onOpen: () => void) => ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [invitations, setInvitations] = useState<IManagedInvitation[]>([]);
    const [link, setLink] = useState('');
    const [createdId, setCreatedId] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [status, setStatus] = useState({ message: '', isError: false });
    const clubId = projection.club.id;
    const isAtCapacity = projection.access.isAtCapacity;
    const canCreate = projection.permissions.createInvitations && !isAtCapacity;

    async function perform(request: () => Promise<TInvitationResult>) {
        setIsPending(true);
        try {
            const result = await request();
            if (!result.ok) {
                setStatus({ message: result.message, isError: true });
                return null;
            }
            if (result.invitations) setInvitations(result.invitations);
            return result;
        } catch {
            setStatus({
                message: 'Invitations could not be updated. Check your connection and try again.',
                isError: true,
            });
            return null;
        } finally {
            setIsPending(false);
        }
    }

    async function create(current: IManagedInvitation[]) {
        const pending = current.filter((invite) => invite.state === 'pending').length;
        if (pending >= projection.entitlements.memberLimit) {
            setStatus({
                message: 'Every active link is still pending. Revoke one in Recent links first.',
                isError: true,
            });
            return;
        }
        const result = await perform(() => createInvitationAction(clubId));
        if (result?.created) showCreated(result.created, result);
    }

    async function open() {
        setIsOpen(true);
        if (hasLoaded) return;
        const loaded = await perform(() => loadInvitationsAction(clubId));
        if (!loaded) return;
        setHasLoaded(true);
        if (canCreate && !link) await create(loaded.invitations ?? []);
    }

    async function handleRevoke(inviteId: string) {
        const result = await perform(() => revokeInvitationAction(clubId, inviteId));
        if (!result) return;
        if (!result.invitations) {
            setInvitations((current) =>
                current.map((invite) =>
                    invite.id === inviteId ? { ...invite, state: 'revoked' } : invite,
                ),
            );
        }
        if (inviteId === createdId) setLink('');
        setStatus({
            message: ['Invitation revoked.', result.refreshError].filter(Boolean).join(' '),
            isError: Boolean(result.refreshError),
        });
    }

    /** Shows the new link once; without a refreshed list, the new link joins the current one. */
    function showCreated(
        created: ICreatedInvitation,
        { invitations, refreshError }: Extract<TInvitationResult, { ok: true }>,
    ) {
        if (!invitations) {
            setInvitations((current) => [
                { id: created.id, expiresAt: created.expiresAt, state: 'pending' },
                ...current,
            ]);
        }
        setLink(`${globalThis.location.origin}/invite/club/${created.token}`);
        setCreatedId(created.id);
        setStatus({
            message: ['Link ready. Share it with one person.', refreshError]
                .filter(Boolean)
                .join(' '),
            isError: Boolean(refreshError),
        });
    }

    async function handleCopy() {
        try {
            await globalThis.navigator.clipboard.writeText(link);
            setIsCopied(true);
            setStatus({ message: 'Link copied.', isError: false });
            setTimeout(() => setIsCopied(false), COPIED_ICON_MS);
        } catch {
            setStatus({
                message: 'Copy is unavailable. Select and copy the invitation link.',
                isError: true,
            });
        }
    }

    return (
        <>
            {trigger(() => void open())}
            <Modal onClose={() => setIsOpen(false)} open={isOpen} title="Invite to this Club">
                <div className={styles.dialog}>
                    {isAtCapacity ? (
                        <p className={styles.note}>
                            The member limit is reached; a seat must free up before the next
                            invitation.
                        </p>
                    ) : null}
                    {projection.permissions.createInvitations || isAtCapacity ? null : (
                        <p className={styles.note}>
                            New invitations are paused. Existing links can still be revoked.
                        </p>
                    )}
                    {link ? (
                        <div className={styles.ticket}>
                            <div className={styles.main}>
                                <span className={styles.kicker}>
                                    Single-use link
                                    <InfoTip label="About single-use links">
                                        Each link admits one person and expires after{' '}
                                        {CLUB_INVITATION_LIFETIME_HOURS} hours.
                                    </InfoTip>
                                </span>
                                <label className="visually-hidden" htmlFor="invitation-link">
                                    Invitation link
                                </label>
                                <input
                                    id="invitation-link"
                                    readOnly
                                    value={link}
                                    onFocus={(event) => event.currentTarget.select()}
                                />
                            </div>
                            <button
                                aria-label="Copy link"
                                className={styles.stub}
                                disabled={isPending}
                                onClick={handleCopy}
                                type="button"
                            >
                                <Icon name={isCopied ? 'check' : 'copy'} />
                            </button>
                        </div>
                    ) : null}
                    {canCreate ? (
                        <Button
                            disabled={isPending || !hasLoaded}
                            fullWidth
                            onClick={() => create(invitations)}
                            variant="secondary"
                        >
                            New link
                        </Button>
                    ) : null}
                    <RecentLinks
                        createdId={createdId}
                        disabled={isPending}
                        invitations={invitations}
                        onRevoke={handleRevoke}
                    />
                    {/* A ready or copied link speaks for itself; only failures stay on screen. */}
                    <p className={status.isError ? styles.status : 'visually-hidden'} role="status">
                        {isPending && !status.message ? 'Updating invitations…' : status.message}
                    </p>
                </div>
            </Modal>
        </>
    );
}

function RecentLinks({
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
        <details className={styles.recent}>
            <summary>
                Recent links ({invitations.length})
                <Icon name="chevron-down" />
            </summary>
            <ul>
                {invitations.map((invite) => {
                    const shortId = invite.id.slice(0, INVITATION_ID_LENGTH);
                    const isCurrent = invite.id === createdId;
                    return (
                        <li data-state={invite.state} key={invite.id}>
                            <span title={invite.id}>
                                {invite.state} · expires {toIsoDate(invite.expiresAt)}
                                {isCurrent ? ' · latest link' : ''}
                            </span>
                            {invite.state === 'pending' ? (
                                <button
                                    aria-label={
                                        isCurrent
                                            ? 'Revoke current link'
                                            : `Revoke invitation ${shortId}`
                                    }
                                    disabled={disabled}
                                    onClick={() => onRevoke(invite.id)}
                                    type="button"
                                >
                                    Revoke
                                </button>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </details>
    );
}
