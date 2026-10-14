import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pickflick/database';

import { findMembership, lockClub } from '../clubs/access/club-access.js';

/** Locks one Session row. Callers that also lock its Club take the Club lock first. */
export async function lockSession(tx: Prisma.TransactionClient, id: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${id}::uuid FOR UPDATE`;
}

/**
 * Locks Club → Session for a write and returns the fresh Session with the caller's Membership.
 * A Session in a Club the caller cannot see is a 404.
 */
export async function lockSessionForMember(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
) {
    const initial = await tx.session.findUnique({ where: { id }, select: { clubId: true } });
    if (!initial) throw new NotFoundException();
    await lockClub(tx, initial.clubId);
    const membership = await findMembership(tx, userId, initial.clubId);
    await lockSession(tx, id);
    return { session: await tx.session.findUniqueOrThrow({ where: { id } }), membership };
}
