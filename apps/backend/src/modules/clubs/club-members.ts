import type { IClubMember } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TMembership } from './access/club-access.js';
import { canRemoveMember } from './access/club-permissions.js';

/** Active members by role then join date, each with the non-cancelled Sessions they accepted. */
export function findActiveMembers(tx: Prisma.TransactionClient, clubId: string) {
    return tx.membership.findMany({
        where: { clubId, status: 'ACTIVE' },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        select: {
            id: true,
            role: true,
            joinedAt: true,
            user: { select: { displayName: true } },
            _count: {
                select: {
                    sessionParticipants: {
                        where: { status: 'ACCEPTED', session: { phase: { not: 'CANCELLED' } } },
                    },
                },
            },
        },
    });
}

/** The member row the Hub and Manage Club show to `viewer`. */
export function toClubMember(
    viewer: TMembership,
    member: Awaited<ReturnType<typeof findActiveMembers>>[number],
): IClubMember {
    return {
        id: member.id,
        displayName: member.user.displayName,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        sessionCount: member._count.sessionParticipants,
        canRemove: canRemoveMember(viewer, member, viewer.club.lifecycle),
    };
}
