import { createHash } from 'node:crypto';

import type { Prisma } from '@pickflick/database';

import { ClubAuthorizationError, ClubConflictError } from './club.errors.js';

/** Fingerprint of one operation's request, stored with its audit event to recognise exact replays. */
export function operationRequestHash(action: string, value: unknown): string {
    return createHash('sha256').update(JSON.stringify({ action, value })).digest('hex');
}

interface RecordedClubOperation {
    readonly action: string;
    readonly actorUserId: string;
    readonly clubId: string;
    readonly requestHash: string | null;
}

export interface ExpectedClubOperation {
    readonly action: string;
    readonly actorUserId: string;
    readonly clubId: string;
    readonly requestHash: string;
    /** Replays of App Admin operations also require the actor to still hold that role. */
    readonly requiresAppAdmin?: boolean;
}

/**
 * An operation ID replays only the exact request its actor already recorded. A still-active actor
 * gets the original receipt; any other use of the same ID is a conflict.
 */
export async function assertClubOperationReplay(
    transaction: Prisma.TransactionClient,
    recorded: RecordedClubOperation,
    expected: ExpectedClubOperation,
): Promise<void> {
    const actor = await transaction.user.findUnique({
        where: { id: expected.actorUserId },
        select: { appRole: true, status: true },
    });
    if (
        actor?.status !== 'ACTIVE' ||
        (expected.requiresAppAdmin && actor.appRole !== 'APP_ADMIN')
    ) {
        throw new ClubAuthorizationError('The current User cannot replay this Club operation.');
    }
    if (
        recorded.action !== expected.action ||
        recorded.actorUserId !== expected.actorUserId ||
        recorded.clubId !== expected.clubId ||
        recorded.requestHash !== expected.requestHash
    ) {
        throw new ClubConflictError(
            'OPERATION_REUSED',
            'The operation identifier was already used for another Club operation.',
        );
    }
}
