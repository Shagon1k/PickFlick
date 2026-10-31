'use client';

import type { IClubMember, IClubSettings, TClubRole } from '@pickflick/contracts';
import { useActionState, useState } from 'react';

import {
    type IClubActionState,
    initialClubActionState,
} from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import { changeClubMemberRolesAction } from '#app/(product)/clubs/[clubId]/(hub)/club-actions';
import Button from '#components/ui/Button/Button';
import Modal from '#components/ui/Modal/Modal';
import { getMonogram } from '#lib/format';

import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';

/** Members move between two groups as a draft; one Save sends only the changed roles. */
export default function ManageModerators({ projection }: { projection: IClubSettings }) {
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState<Record<string, TClubRole>>({});
    const [state, formAction, isPending] = useActionState(
        async (previous: IClubActionState, formData: FormData) => {
            const result = await changeClubMemberRolesAction(
                projection.club.id,
                previous,
                formData,
            );
            // Saved roles now come from the refreshed projection.
            if (result.status === 'success') setDraft({});
            return result;
        },
        initialClubActionState,
    );
    const canEdit = projection.permissions.manageRoles && projection.club.lifecycle === 'ACTIVE';
    const roleOf = (member: IClubMember) => draft[member.id] ?? member.role;
    const changed = projection.members.filter(
        (member) => member.role !== 'ADMIN' && roleOf(member) !== member.role,
    );
    const team = projection.members.filter((member) => roleOf(member) !== 'MEMBER');
    const members = projection.members.filter((member) => roleOf(member) === 'MEMBER');

    function handleClose() {
        setDraft({});
        setIsOpen(false);
    }

    function renderGroup(title: string, group: IClubMember[]) {
        return (
            <section aria-label={title}>
                <h3 className={styles.kicker}>{title}</h3>
                {group.length ? (
                    <ul className={styles.memberList}>
                        {group.map((member) => (
                            <li className={styles.member} key={member.id}>
                                <div className={styles.memberIdentity}>
                                    <span aria-hidden="true">
                                        {getMonogram(member.displayName)}
                                    </span>
                                    <strong>{member.displayName}</strong>
                                </div>
                                {member.role === 'ADMIN' ? (
                                    <span className={styles.lockedRole}>Admin</span>
                                ) : (
                                    <Button
                                        aria-label={`${roleOf(member) === 'MEMBER' ? 'Promote' : 'Remove'} ${member.displayName}`}
                                        disabled={!canEdit || isPending}
                                        onClick={() =>
                                            setDraft({
                                                ...draft,
                                                [member.id]:
                                                    roleOf(member) === 'MEMBER'
                                                        ? 'MODERATOR'
                                                        : 'MEMBER',
                                            })
                                        }
                                        size="small"
                                        variant="secondary"
                                    >
                                        {roleOf(member) === 'MEMBER' ? 'Promote' : 'Remove'}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={styles.cardLead}>Nobody yet.</p>
                )}
            </section>
        );
    }

    return (
        <>
            <Button onClick={() => setIsOpen(true)} size="small" variant="secondary">
                Manage Moderators
            </Button>
            <Modal
                actions={
                    <form action={formAction} className={styles.moderatorSave}>
                        {changed.map((member) => (
                            <input
                                key={member.id}
                                name={`role:${member.id}`}
                                type="hidden"
                                value={roleOf(member)}
                            />
                        ))}
                        <Button
                            disabled={!canEdit || !changed.length}
                            fullWidth
                            loading={isPending}
                            type="submit"
                        >
                            Save changes
                        </Button>
                    </form>
                }
                onClose={handleClose}
                open={isOpen}
                title="Manage Moderators"
            >
                <div className={styles.moderatorGroups}>
                    {renderGroup('Moderators', team)}
                    {renderGroup('Members', members)}
                </div>
                <ActionStatus state={state} />
            </Modal>
        </>
    );
}
