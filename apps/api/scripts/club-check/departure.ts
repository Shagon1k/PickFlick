import { randomUUID } from 'node:crypto';

import { ClubConflictError } from '../../src/clubs/club.errors.js';
import { database, ids, management, onboarding, principal } from './harness.js';

export async function checkLeaveAndDelete(createdClub: {
    readonly id: string;
    readonly name: string;
}) {
    const leaveOperationId = randomUUID();
    const leave = await management.leave(principal(ids.member), ids.club, {
        operationId: leaveOperationId,
        confirmation: 'LEAVE',
    });
    const leaveRetry = await management.leave(principal(ids.member), ids.club, {
        operationId: leaveOperationId,
        confirmation: 'LEAVE',
    });
    const departed = await database.membership.findUnique({
        where: { id: ids.memberMembership },
        select: { status: true, leftAt: true },
    });
    if (
        !leave.changed ||
        leave.replayed ||
        !leaveRetry.replayed ||
        departed?.status !== 'LEFT' ||
        !departed.leftAt
    ) {
        throw new Error(
            'Membership leave did not persist one retry-safe departure and audit receipt.',
        );
    }

    const deleteOperationId = randomUUID();
    await management
        .delete(principal(ids.creator), createdClub.id, {
            operationId: randomUUID(),
            confirmation: 'wrong name',
        })
        .then(
            () => {
                throw new Error('Club deletion accepted an incorrect typed-name confirmation.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubConflictError)) {
                    throw error;
                }
            },
        );
    const deleted = await management.delete(principal(ids.creator), createdClub.id, {
        operationId: deleteOperationId,
        confirmation: createdClub.name,
    });
    const deleteRetry = await management.delete(principal(ids.creator), createdClub.id, {
        operationId: deleteOperationId,
        confirmation: createdClub.name,
    });
    const deletedClub = await database.club.findUnique({
        where: { id: createdClub.id },
        select: { deletedAt: true },
    });
    const visibleAfterDelete = await onboarding.list(principal(ids.creator));
    if (
        !deleted.changed ||
        deleted.replayed ||
        !deleteRetry.replayed ||
        !deletedClub?.deletedAt ||
        visibleAfterDelete.clubs.length !== 0
    ) {
        throw new Error(
            'Empty Club deletion did not tombstone access while preserving an idempotent audit receipt.',
        );
    }
}
