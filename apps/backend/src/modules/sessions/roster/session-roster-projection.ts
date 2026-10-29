import { NotFoundException } from '@nestjs/common';
import { type ISessionRoster, isOpenSessionPhase } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { getInviteState } from '../../../common/invite-token.js';
import { findMembership } from '../../clubs/access/club-access.js';
import { canJoinSession, canManage } from '../session-access.js';

export async function readRoster(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
): Promise<ISessionRoster> {
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    const membership = await findMembership(tx, userId, session.clubId);
    const isOpen = isOpenSessionPhase(session.phase);
    // One rule decides every roster control: invite, revoke, and remove.
    const isManager = isOpen && (await canManage(tx, membership));
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
        acceptedCount: participants.filter((participant) => participant.status === 'ACCEPTED')
            .length,
        canInvite: isManager,
        canManage: isManager,
        canJoin: canJoinSession({
            phase: session.phase,
            clubLifecycle: membership.club.lifecycle,
            ownStatus: participants.find(
                (participant) => participant.membershipId === membership.id,
            )?.status,
        }),
        canLeave:
            isOpen &&
            participants.some(
                (participant) =>
                    participant.membershipId === membership.id && participant.status === 'ACCEPTED',
            ),
        participants: participants
            .filter(
                (participant) =>
                    isManager ||
                    participant.status === 'ACCEPTED' ||
                    participant.membershipId === membership.id,
            )
            .map((participant) => ({
                id: participant.id,
                membershipId: participant.membershipId,
                displayName: participant.membership.user.displayName,
                status: participant.status,
                canRemove:
                    isManager &&
                    participant.membershipId !== membership.id &&
                    ['INVITED', 'ACCEPTED'].includes(participant.status),
                invitation:
                    isManager && participant.invitations[0]
                        ? {
                              id: participant.invitations[0].id,
                              expiresAt: participant.invitations[0].expiresAt.toISOString(),
                              state: getInviteState(participant.invitations[0]),
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
              ).map((membership) => ({
                  id: membership.id,
                  displayName: membership.user.displayName,
              }))
            : [],
    };
}
