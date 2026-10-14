import { NotFoundException } from '@nestjs/common';
import { type ISessionRoster, isOpenSessionPhase } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { inviteState } from '../../../common/invite-token.js';
import { findMembership } from '../../clubs/access/club-access.js';
import { canManage } from '../session-access.js';

export async function readRoster(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
): Promise<ISessionRoster> {
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    const member = await findMembership(tx, userId, session.clubId);
    const isOpen = isOpenSessionPhase(session.phase);
    // One rule decides every roster control: invite, revoke, and remove.
    const isManager = isOpen && (await canManage(tx, member));
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
        canInvite: isManager,
        canManage: isManager,
        canLeave:
            isOpen &&
            participants.some((p) => p.membershipId === member.id && p.status === 'ACCEPTED'),
        participants: participants
            .filter((p) => isManager || p.status === 'ACCEPTED' || p.membershipId === member.id)
            .map((p) => ({
                id: p.id,
                membershipId: p.membershipId,
                displayName: p.membership.user.displayName,
                status: p.status,
                canRemove:
                    isManager &&
                    p.membershipId !== member.id &&
                    ['INVITED', 'ACCEPTED'].includes(p.status),
                invitation:
                    isManager && p.invitations[0]
                        ? {
                              id: p.invitations[0].id,
                              expiresAt: p.invitations[0].expiresAt.toISOString(),
                              state: inviteState(p.invitations[0]),
                          }
                        : null,
            })),
        eligibleMembers: isManager
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
