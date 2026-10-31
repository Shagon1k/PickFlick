import type { ISessionRoster } from '@pickflick/contracts';
import type { RefObject } from 'react';

import Button from '#components/ui/Button/Button';
import Modal from '#components/ui/Modal/Modal';
import { getMonogram } from '#lib/format';

import { describeStatus } from './roster-status';
import styles from './SessionRoster.module.scss';

type TParticipant = ISessionRoster['participants'][number];

/** The operator list of current participants, with Revoke and Remove. */
export default function KickDialog({
    open,
    participants,
    canRevoke,
    disabled,
    status,
    isSuccess,
    isConfirming,
    closeRef,
    onClose,
    onRevoke,
    onRemove,
}: {
    open: boolean;
    participants: TParticipant[];
    canRevoke: boolean;
    disabled: boolean;
    status: string;
    isSuccess: boolean;
    /** Escape then belongs to the confirmation stacked above, not to this list. */
    isConfirming: boolean;
    closeRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    onRevoke: (inviteId: string) => void;
    onRemove: (participant: TParticipant) => void;
}) {
    return (
        <Modal
            actions={
                <Button ref={closeRef} onClick={onClose} variant="secondary">
                    Close
                </Button>
            }
            isDismissible={!isConfirming}
            onClose={onClose}
            open={open}
            title="Kick participants"
        >
            {participants.length ? (
                <ul className={styles.list}>
                    {participants.map((participant) => (
                        <KickRow
                            key={participant.id}
                            participant={participant}
                            canRevoke={canRevoke}
                            disabled={disabled}
                            onRevoke={onRevoke}
                            onRemove={() => onRemove(participant)}
                        />
                    ))}
                </ul>
            ) : (
                <p>No participants can be removed.</p>
            )}
            <p
                aria-live="polite"
                className={isSuccess ? 'visually-hidden' : undefined}
                role="status"
            >
                {open ? status : ''}
            </p>
        </Modal>
    );
}

function KickRow({
    participant,
    canRevoke,
    disabled,
    onRevoke,
    onRemove,
}: {
    participant: TParticipant;
    canRevoke: boolean;
    disabled: boolean;
    onRevoke: (inviteId: string) => void;
    onRemove: () => void;
}) {
    const { displayName, invitation } = participant;
    return (
        <li className={styles.row}>
            <span aria-hidden="true" className={styles.avatar}>
                {getMonogram(displayName)}
            </span>
            <span className={styles.name}>
                {displayName}
                <small>{describeStatus(participant)}</small>
            </span>
            {invitation?.state === 'pending' && canRevoke ? (
                <Button
                    aria-label={`Revoke invite for ${displayName}`}
                    disabled={disabled}
                    onClick={() => onRevoke(invitation.id)}
                    size="small"
                    variant="secondary"
                >
                    Revoke
                </Button>
            ) : null}
            {participant.canRemove ? (
                <Button
                    aria-label={`Remove ${displayName}`}
                    disabled={disabled}
                    onClick={onRemove}
                    size="small"
                    variant="secondary-danger"
                >
                    Kick
                </Button>
            ) : null}
        </li>
    );
}
