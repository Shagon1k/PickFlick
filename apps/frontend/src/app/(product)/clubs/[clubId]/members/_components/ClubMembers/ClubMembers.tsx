'use client';

import type { IClubMember, IClubSettings } from '@pickflick/contracts';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { initialClubActionState } from '@/app/(product)/clubs/[clubId]/settings/action-state';
import { removeClubMemberAction } from '@/app/(product)/clubs/[clubId]/settings/actions';
import ClubStatus from '@/components/clubs/ClubStatus/ClubStatus';
import { clubNavigation } from '@/components/shells/shell-navigation';
import Button from '@/components/ui/Button/Button';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { formatUtcDate, monogram } from '@/lib/format';

import styles from '../../page.module.scss';

export default function ClubMembers({ projection }: { projection: IClubSettings }) {
    const [selected, setSelected] = useState<IClubMember | null>(null);
    const [message, setMessage] = useState('');
    const [isPending, setIsPending] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const returnToHeadingRef = useRef(false);
    const { club, permissions, members, currentMembershipId } = projection;
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
        <main className={styles.layout}>
            <header className={styles.hero}>
                <p className={styles.eyebrow}>Club Hub</p>
                <h1>{club.name}</h1>
                <p>
                    {members.length} of {projection.entitlements.memberLimit} members · You are{' '}
                    {club.membershipRole.toLowerCase()}
                </p>
            </header>
            <nav aria-label="Club sections" className={styles.tabs}>
                {clubNavigation(club.id, 'members').map((item) => (
                    <Link
                        aria-current={item.current ? 'page' : undefined}
                        href={item.href}
                        key={item.label}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>
            <ClubStatus access={projection.access} />
            <div className={styles.sectionHeading}>
                <h2 ref={headingRef} tabIndex={-1}>
                    Members
                </h2>
                <ButtonLink href={`/clubs/${club.id}/settings`}>
                    {permissions.createInvitations ? 'Invite members' : 'Club settings'}
                </ButtonLink>
            </div>
            <p className={styles.explanation}>{roleExplanation}</p>
            <p aria-live="polite" role="status">
                {selected ? '' : message}
            </p>
            <ul className={styles.memberList}>
                {members.map((member) => (
                    <li className={styles.member} key={member.id}>
                        <div className={styles.identity}>
                            <span aria-hidden="true" className={styles.monogram}>
                                {monogram(member.displayName)}
                            </span>
                            <div>
                                <strong>
                                    {member.displayName}
                                    {member.id === currentMembershipId ? ' (you)' : ''}
                                </strong>
                                <small>
                                    {member.role.toLowerCase()} · Joined{' '}
                                    {formatUtcDate(member.joinedAt)}
                                </small>
                            </div>
                        </div>
                        {member.canRemove ? (
                            <Button
                                aria-label={`Remove ${member.displayName}`}
                                onClick={() => {
                                    setMessage('');
                                    setSelected(member);
                                }}
                                variant="secondary-danger"
                            >
                                Remove
                            </Button>
                        ) : null}
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
                pending={isPending}
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
        </main>
    );
}
