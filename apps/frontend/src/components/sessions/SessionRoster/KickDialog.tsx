import type { ISessionRoster } from '@pickflick/contracts';
import type { RefObject } from 'react';

import Button from '#components/ui/Button/Button';
import Modal from '#components/ui/Modal/Modal';
import { getMonogram } from '#lib/format';

import styles from './SessionRoster.module.scss';

type TParticipant = ISessionRoster['participants'][number];

const STATUS_LABELS: Record<TParticipant['status'], string> = {
    INVITED: 'Invited',
    ACCEPTED: 'Joined',
    DECLINED: 'Declined',
    LEFT: 'Left',
    REMOVED: 'Removed',
};

/** The operator list of current participants, each with Kick when the operator may remove them. */
export default function KickDialog({
    open,
    participants,
    disabled,
    status,
    isSuccess,
    isConfirming,
    closeRef,
    onClose,
    onRemove,
}: {
    open: boolean;
    participants: TParticipant[];
    disabled: boolean;
    status: string;
    isSuccess: boolean;
    /** Escape then belongs to the confirmation stacked above, not to this list. */
    isConfirming: boolean;
    closeRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
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
                            disabled={disabled}
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
    disabled,
    onRemove,
}: {
    participant: TParticipant;
    disabled: boolean;
    onRemove: () => void;
}) {
    const { displayName } = participant;
    return (
        <li className={styles.row}>
            <span aria-hidden="true" className={styles.avatar}>
                {getMonogram(displayName)}
            </span>
            <span className={styles.name}>
                {displayName}
                <small>{STATUS_LABELS[participant.status]}</small>
            </span>
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
