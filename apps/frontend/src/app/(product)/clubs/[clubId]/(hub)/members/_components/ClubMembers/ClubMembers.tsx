'use client';

import type { IClubMember, IClubSettings } from '@pickflick/contracts';
import { useRef, useState } from 'react';

import { initialClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import { removeClubMemberAction } from '#app/(product)/clubs/[clubId]/(hub)/club-actions';
import InviteDialog from '#components/clubs/InviteDialog/InviteDialog';
import Avatar from '#components/ui/Avatar/Avatar';
import Button from '#components/ui/Button/Button';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Icon from '#components/ui/Icon/Icon';
import { formatCount } from '#lib/format';

import styles from '../../page.module.scss';

export default function ClubMembers({ projection }: { projection: IClubSettings }) {
    const [selected, setSelected] = useState<IClubMember | null>(null);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const returnToHeadingRef = useRef(false);
    const { club, permissions, members, currentMembershipId } = projection;
    const hasRemovals = members.some((member) => member.canRemove);
    async function remove(confirmation: string) {
        if (!selected) return;
        const formData = new FormData();
        formData.set('confirmation', confirmation);
        setIsPending(true);
        try {
            const result = await removeClubMemberAction(
                club.id,
                selected.id,
                initialClubActionState,
                formData,
            );
            setMessage(result.message);
            setIsSuccess(result.status === 'success');
            if (result.status === 'success') {
                returnToHeadingRef.current = true;
                setSelected(null);
            }
        } catch {
            setIsSuccess(false);
            setMessage(
                'Member removal could not be confirmed. Reload to check the roster, then retry.',
            );
        } finally {
            setIsPending(false);
        }
    }
    return (
        <section aria-label="Club members">
            <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
                Members
            </h2>
            <p
                className={isSuccess ? 'visually-hidden' : styles.feedback}
                aria-live="polite"
                role="status"
            >
                {selected ? '' : message}
            </p>
            <ul className={styles.memberList}>
                {members.map((member) => (
                    <li className={styles.member} key={member.id}>
                        <div className={styles.identity}>
                            <Avatar
                                name={member.displayName}
                                src={member.avatarUrl}
                                size="large"
                                withColorReveal={false}
                            />
                            <div className={styles.identityCopy}>
                                <strong>
                                    {member.displayName}
                                    {member.id === currentMembershipId ? ' (you)' : ''}
                                </strong>
                                <small>{member.role.toLowerCase()}</small>
                            </div>
                        </div>
                        <div className={styles.memberActions}>
                            <span
                                className={styles.sessionCount}
                                aria-label={formatCount(member.sessionCount, 'session')}
                            >
                                <strong>{member.sessionCount}</strong>
                                <small>{member.sessionCount === 1 ? 'session' : 'sessions'}</small>
                            </span>
                            {member.canRemove ? (
                                <button
                                    type="button"
                                    className={styles.remove}
                                    aria-label={`Remove ${member.displayName}`}
                                    onClick={() => {
                                        setMessage('');
                                        setSelected(member);
                                    }}
                                >
                                    <Icon name="close" />
                                </button>
                            ) : (
                                // Keeps the session counts in one column when other rows can be removed.
                                hasRemovals && <span aria-hidden="true" className={styles.remove} />
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            {permissions.createInvitations ? (
                <div className={styles.inviteAction}>
                    <InviteDialog
                        projection={projection}
                        trigger={(onOpen) => (
                            <Button fullWidth onClick={onOpen} variant="secondary">
                                <Icon name="user-plus" />
                                Invite
                            </Button>
                        )}
                    />
                </div>
            ) : null}
            <ConfirmDialog
                confirmLabel="Confirm removal"
                inputId="remove-confirmation"
                onClose={() => setSelected(null)}
                onConfirm={(confirmation) => void remove(confirmation)}
                onExitTransitionEnd={() => {
                    if (returnToHeadingRef.current) {
                        headingRef.current?.focus();
                        returnToHeadingRef.current = false;
                    }
                }}
                open={Boolean(selected)}
                isPending={isPending}
                status={
                    <p aria-live="polite" role="status">
                        {message}
                    </p>
                }
                title="Remove this member?"
                word="REMOVE"
            >
                <p>
                    {selected?.displayName} will lose access to this private Club. Shared Club and
                    Session history remains.
                </p>
            </ConfirmDialog>
        </section>
    );
}
