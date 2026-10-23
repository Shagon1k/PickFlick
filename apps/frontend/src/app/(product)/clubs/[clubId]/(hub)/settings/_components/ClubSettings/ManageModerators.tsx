'use client';

import { type IClubMember, type IClubSettings } from '@pickflick/contracts';
import { useActionState, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Modal from '#components/ui/Modal/Modal';
import { formatUtcDate, getMonogram } from '#lib/format';

import { initialClubActionState } from '../../action-state';
import { changeClubMemberRoleAction } from '../../actions';
import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';

function MemberRoleForm({
    clubId,
    member,
    writable,
}: {
    clubId: string;
    member: IClubMember;
    writable: boolean;
}) {
    const action = changeClubMemberRoleAction.bind(null, clubId, member.id);
    const [state, formAction, isPending] = useActionState(action, initialClubActionState);
    if (member.role === 'ADMIN') {
        return <span className={styles.lockedRole}>Admin</span>;
    }
    return (
        <form action={formAction} className={styles.roleForm}>
            <fieldset className={styles.roleChoice} disabled={!writable}>
                <legend className="visually-hidden">Role for {member.displayName}</legend>
                {(['MEMBER', 'MODERATOR'] as const).map((role) => (
                    <label key={role}>
                        <input
                            defaultChecked={member.role === role}
                            name="role"
                            type="radio"
                            value={role}
                        />
                        <span>{role === 'MEMBER' ? 'Member' : 'Moderator'}</span>
                    </label>
                ))}
            </fieldset>
            <Button
                disabled={!writable}
                loading={isPending}
                size="small"
                type="submit"
                variant="secondary"
            >
                Save role
            </Button>
            <ActionStatus state={state} />
        </form>
    );
}

export default function ManageModerators({ projection }: { projection: IClubSettings }) {
    const [isOpen, setIsOpen] = useState(false);
    const canEdit = projection.permissions.manageRoles && projection.club.lifecycle === 'ACTIVE';
    return (
        <>
            <Button onClick={() => setIsOpen(true)} size="small" variant="secondary">
                Manage Moderators
            </Button>
            <Modal
                actions={
                    <Button onClick={() => setIsOpen(false)} variant="secondary">
                        Close
                    </Button>
                }
                onClose={() => setIsOpen(false)}
                open={isOpen}
                title="Manage Moderators"
            >
                <p className={styles.explanation}>
                    Moderators run Sessions with you. {projection.members.length} of{' '}
                    {projection.entitlements.memberLimit} member places are in use.
                </p>
                <ul className={styles.memberList}>
                    {projection.members.map((member) => (
                        <li className={styles.member} key={member.id}>
                            <div className={styles.memberIdentity}>
                                <span aria-hidden="true">{getMonogram(member.displayName)}</span>
                                <div>
                                    <strong>{member.displayName}</strong>
                                    <small>Joined {formatUtcDate(member.joinedAt)}</small>
                                </div>
                            </div>
                            <MemberRoleForm
                                clubId={projection.club.id}
                                member={member}
                                writable={canEdit}
                            />
                        </li>
                    ))}
                </ul>
            </Modal>
        </>
    );
}
