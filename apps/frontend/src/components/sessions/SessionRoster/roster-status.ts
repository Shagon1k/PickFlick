import type { ISessionRoster } from '@pickflick/contracts';

type TParticipant = ISessionRoster['participants'][number];

const STATUS_LABELS: Record<TParticipant['status'], string> = {
    INVITED: 'Invited',
    ACCEPTED: 'Joined',
    DECLINED: 'Declined',
    LEFT: 'Left',
    REMOVED: 'Removed',
};

const INVITATION_LABELS: Record<NonNullable<TParticipant['invitation']>['state'], string> = {
    pending: 'awaiting reply',
    expired: 'invite expired',
    revoked: 'invite revoked',
    accepted: 'accepted',
    declined: 'declined',
};

/** A participant's roster state in words, such as `Invited · awaiting reply`. */
export function describeStatus({ status, invitation }: TParticipant): string {
    if (status !== 'INVITED' || !invitation) return STATUS_LABELS[status];
    return `Invited · ${INVITATION_LABELS[invitation.state]}`;
}
