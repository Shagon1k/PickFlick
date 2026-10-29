'use client';

import type { IClubMember, IClubSettings } from '@pickflick/contracts';
import { useRef, useState } from 'react';

import { initialClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import { removeClubMemberAction } from '#app/(product)/clubs/[clubId]/(hub)/club-actions';
import ButtonLink from '#components/ui/Button/ButtonLink';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import Icon from '#components/ui/Icon/Icon';
import { formatCount, getMonogram } from '#lib/format';

import styles from '../../page.module.scss';

export default function ClubMembers({ projection }: { projection: IClubSettings }) {
    const [selected, setSelected] = useState<IClubMember | null>(null);
    const [message, setMessage] = useState('');
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
            if (result.status === 'success') {
                returnToHeadingRef.current = true;
                setSelected(null);
            }
        } catch {
            setMessage(
                'Member removal could not be confirmed. Reload to check the roster, then retry.',
            );
        } finally {
            setIsPending(false);
        }
    }
    const roleExplanation = {
        ADMIN: 'Manage Moderator roles in Manage Club. You can remove Members and Moderators.',
        MODERATOR: 'You can remove Members. Only the Admin manages roles or removes Moderators.',
        MEMBER: 'You can view the roster and leave from Manage Club.',
    }[club.membershipRole];
    return (
        <section className={styles.layout} aria-label="Club members">
            <div className={styles.sectionHeading}>
                <h2 ref={headingRef} tabIndex={-1}>
                    Members
                </h2>
                <ButtonLink href={`/clubs/${club.id}/settings`} size="small">
                    {permissions.createInvitations ? '+ Invite' : 'Club settings'}
                </ButtonLink>
            </div>
            <p className={styles.explanation}>{roleExplanation}</p>
            <p className={styles.feedback} aria-live="polite" role="status">
                {selected ? '' : message}
            </p>
            <ul className={styles.memberList}>
                {members.map((member) => (
                    <li className={styles.member} key={member.id}>
                        <div className={styles.identity}>
                            <span aria-hidden="true" className={styles.monogram}>
                                {getMonogram(member.displayName)}
                            </span>
                            <div>
                                <strong>
                                    {member.displayName}
                                    {member.id === currentMembershipId ? ' (you)' : ''}
                                </strong>
                                <small>{member.role.toLowerCase()}</small>
                            </div>
                        </div>
                        <div className={styles.memberActions}>
                            <span className={styles.sessionCount}>
                                {formatCount(member.sessionCount, 'session')}
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
