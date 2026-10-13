'use client';

import { type IClubMember, type IClubSettings } from '@pickflick/contracts';
import { startTransition, useActionState, useState } from 'react';

import Button from '@/components/ui/Button/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';
import InfoTip from '@/components/ui/InfoTip/InfoTip';
import Modal from '@/components/ui/Modal/Modal';

import { initialClubActionState } from '../../action-state';
import { changeClubMemberRoleAction, clubLifecycleAction } from '../../actions';
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
    const [state, formAction, pending] = useActionState(action, initialClubActionState);
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
                loading={pending}
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

function ManageModerators({ projection }: { projection: IClubSettings }) {
    const [open, setOpen] = useState(false);
    const writable = projection.permissions.manageRoles && projection.club.lifecycle === 'ACTIVE';
    return (
        <>
            <Button onClick={() => setOpen(true)} size="small" variant="secondary">
                Manage Moderators
            </Button>
            <Modal onClose={() => setOpen(false)} open={open} title="Manage Moderators">
                <p className={styles.explanation}>
                    Moderators run Sessions with you. {projection.members.length} of{' '}
                    {projection.entitlements.memberLimit} member places are in use.
                </p>
                <ul className={styles.memberList}>
                    {projection.members.map((member) => (
                        <li className={styles.member} key={member.id}>
                            <div className={styles.memberIdentity}>
                                <span aria-hidden="true">
                                    {member.displayName.slice(0, 2).toUpperCase()}
                                </span>
                                <div>
                                    <strong>{member.displayName}</strong>
                                    <small>
                                        Joined{' '}
                                        {new Date(member.joinedAt).toLocaleDateString('en', {
                                            timeZone: 'UTC',
                                        })}
                                    </small>
                                </div>
                            </div>
                            <MemberRoleForm
                                clubId={projection.club.id}
                                member={member}
                                writable={writable}
                            />
                        </li>
                    ))}
                </ul>
            </Modal>
        </>
    );
}

function ConfirmAction({
    action,
    clubId,
    confirmation,
    description,
    label,
    title,
    variant = 'secondary-danger',
}: {
    action: 'archive' | 'delete' | 'leave';
    clubId: string;
    confirmation: string;
    description: string;
    label: string;
    title: string;
    variant?: 'secondary-danger' | 'danger';
}) {
    const serverAction = clubLifecycleAction.bind(null, clubId, action);
    const [state, formAction, pending] = useActionState(serverAction, initialClubActionState);
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button onClick={() => setOpen(true)} size="small" variant={variant}>
                {label}
            </Button>
            <ConfirmDialog
                confirmLabel={`Confirm ${label.toLowerCase()}`}
                inputId={`${action}-confirmation`}
                onClose={() => setOpen(false)}
                onConfirm={(typed) => {
                    const formData = new FormData();
                    formData.set('confirmation', typed);
                    startTransition(() => formAction(formData));
                }}
                open={open}
                pending={pending}
                status={<ActionStatus state={state} />}
                title={title}
                word={confirmation}
            >
                <p>{description}</p>
            </ConfirmDialog>
        </>
    );
}

function ReactivateAction({ clubId }: { clubId: string }) {
    const action = clubLifecycleAction.bind(null, clubId, 'reactivate');
    const [state, formAction, pending] = useActionState(action, initialClubActionState);
    return (
        <form action={formAction} className={styles.inlineForm}>
            <Button loading={pending} size="small" type="submit">
                Reactivate Club
            </Button>
            <ActionStatus state={state} />
        </form>
    );
}

export default function ClubDangerZone({ projection }: { projection: IClubSettings }) {
    const active = projection.club.lifecycle === 'ACTIVE';
    const isAdmin = projection.club.membershipRole === 'ADMIN';
    const clubId = projection.club.id;
    const deleteAction = (
        <ConfirmAction
            action="delete"
            clubId={clubId}
            confirmation={projection.club.name}
            description="This removes every active Membership and cannot be undone from the Club UI. Clubs with Session history cannot be deleted."
            label="Delete Club"
            title="Delete this Club?"
        />
    );
    return (
        <section
            aria-labelledby="club-danger-title"
            className={`${styles.card} ${styles.dangerZone}`}
        >
            <div className={styles.cardTitle}>
                <h2 id="club-danger-title">Danger Zone</h2>
                <InfoTip label="About these actions">
                    {isAdmin
                        ? 'Admins cannot leave their own Club. Delete it while it is empty, or ask the App Admin to transfer it.'
                        : 'Leaving ends your Membership immediately. Shared Club history remains for its members.'}
                </InfoTip>
            </div>
            {isAdmin ? (
                <>
                    <div className={styles.dangerActions}>
                        {active ? <ManageModerators projection={projection} /> : null}
                        {active ? (
                            <ConfirmAction
                                action="archive"
                                clubId={clubId}
                                confirmation="ARCHIVE"
                                description="The Club becomes read-only until you reactivate it. Members keep access to its history."
                                label="Archive Club"
                                title="Archive this Club?"
                            />
                        ) : (
                            <ReactivateAction clubId={clubId} />
                        )}
                        {deleteAction}
                    </div>
                </>
            ) : (
                <div className={styles.dangerActions}>
                    <ConfirmAction
                        action="leave"
                        clubId={clubId}
                        confirmation="LEAVE"
                        description="You will lose access to this private Club. Shared history remains for its members."
                        label="Leave Club"
                        title="Leave this Club?"
                    />
                </div>
            )}
        </section>
    );
}
