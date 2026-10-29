'use client';

import { type IClubSettings } from '@pickflick/contracts';
import { startTransition, useActionState, useState } from 'react';

import { initialClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import { changeClubLifecycleAction } from '#app/(product)/clubs/[clubId]/(hub)/club-actions';
import Button from '#components/ui/Button/Button';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import InfoTip from '#components/ui/InfoTip/InfoTip';

import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';

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
    const serverAction = changeClubLifecycleAction.bind(null, clubId, action);
    const [state, formAction, isPending] = useActionState(serverAction, initialClubActionState);
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            <Button onClick={() => setIsOpen(true)} size="small" variant={variant}>
                {label}
            </Button>
            <ConfirmDialog
                confirmLabel={`Confirm ${label.toLowerCase()}`}
                inputId={`${action}-confirmation`}
                onClose={() => setIsOpen(false)}
                onConfirm={(typed) => {
                    const formData = new FormData();
                    formData.set('confirmation', typed);
                    startTransition(() => formAction(formData));
                }}
                open={isOpen}
                isPending={isPending}
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
    const action = changeClubLifecycleAction.bind(null, clubId, 'reactivate');
    const [state, formAction, isPending] = useActionState(action, initialClubActionState);
    return (
        <form action={formAction} className={styles.inlineForm}>
            <Button loading={isPending} size="small" type="submit">
                Reactivate Club
            </Button>
            <ActionStatus state={state} />
        </form>
    );
}

export default function ClubDangerZone({ projection }: { projection: IClubSettings }) {
    const isActive = projection.club.lifecycle === 'ACTIVE';
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
            <p className={styles.cardLead}>
                {isAdmin
                    ? 'Archiving makes the Club read-only; deleting cannot be undone.'
                    : 'Leaving ends your Membership in this Club.'}
            </p>
            {isAdmin ? (
                <div className={styles.cardActions}>
                    {isActive ? (
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
            ) : (
                <div className={styles.cardActions}>
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
