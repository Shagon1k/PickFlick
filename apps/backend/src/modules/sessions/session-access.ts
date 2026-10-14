import { ConflictException, ForbiddenException } from '@nestjs/common';
import { isOpenSessionPhase } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { type findMembership, loadClubAccess } from '../clubs/access/club-access.js';
import { getClubPermissions } from '../clubs/access/club-permissions.js';

export async function canManage(
    transaction: Prisma.TransactionClient,
    membership: Awaited<ReturnType<typeof findMembership>>,
) {
    const { access } = await loadClubAccess(transaction, membership.club);
    return getClubPermissions(membership.role, membership.club.lifecycle, access).manageSessions;
}

export function assertOpen(phase: string) {
    if (!isOpenSessionPhase(phase)) throw new ConflictException({ reason: 'SESSION_CLOSED' });
}
/**
 * The one Session management rule: Admins and Moderators, in an active Club that has an Admin
 * and is within its member limit. Members get 403; a restricted Club gets `CLUB_READ_ONLY`.
 */
export async function assertManager(
    transaction: Prisma.TransactionClient,
    membership: Awaited<ReturnType<typeof findMembership>>,
) {
    if (membership.role === 'MEMBER') throw new ForbiddenException();
    if (!(await canManage(transaction, membership)))
        throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
}
