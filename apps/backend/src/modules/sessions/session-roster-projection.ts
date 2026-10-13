import { NotFoundException } from '@nestjs/common';
import type { ISessionRoster } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { findMembership } from '../clubs/club-access.js';
import { canManage, invitationState, openPhases } from './session-roster-access.js';

export async function readRoster(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
): Promise<ISessionRoster> {
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    const member = await findMembership(tx, userId, session.clubId);
    const open = openPhases.some((phase) => phase === session.phase);
    const manager = open && (await canManage(tx, member));
    const canInvite = manager;
    const participants = await tx.sessionParticipant.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        include: {
            membership: { include: { user: true } },
            invitations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });
    return {
        progressVersion: session.progressVersion,
        acceptedCount: participants.filter((p) => p.status === 'ACCEPTED').length,
        canInvite,
        canManage: manager,
        canLeave:
            open &&
            participants.some((p) => p.membershipId === member.id && p.status === 'ACCEPTED'),
        participants: participants
            .filter((p) => manager || p.status === 'ACCEPTED' || p.membershipId === member.id)
            .map((p) => ({
                id: p.id,
                membershipId: p.membershipId,
                displayName: p.membership.user.displayName,
                status: p.status,
                canRemove:
                    manager &&
                    p.membershipId !== member.id &&
                    ['INVITED', 'ACCEPTED'].includes(p.status),
                invitation:
                    manager && p.invitations[0]
                        ? {
                              id: p.invitations[0].id,
                              expiresAt: p.invitations[0].expiresAt.toISOString(),
                              state: invitationState(p.invitations[0]),
                          }
                        : null,
            })),
        eligibleMembers: canInvite
            ? (
                  await tx.membership.findMany({
                      where: {
                          clubId: session.clubId,
                          status: 'ACTIVE',
                          user: { status: 'ACTIVE' },
                          sessionParticipants: {
                              none: { sessionId, status: 'ACCEPTED' },
                          },
                      },
                      orderBy: { joinedAt: 'asc' },
                      include: { user: true },
                  })
              ).map((m) => ({ id: m.id, displayName: m.user.displayName }))
            : [],
    };
}
