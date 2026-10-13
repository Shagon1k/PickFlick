import { ConflictException, ForbiddenException } from '@nestjs/common';
import { isOpenSessionPhase, type TSessionInvitationPreview } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import {
    type findMembership,
    loadClubAccess,
    recordAudit,
    type TAuditEvent,
} from '../clubs/club-access.js';
import { clubPermissions } from '../clubs/club-permissions.js';
import { completeNomination } from './session-progress.js';

export async function canManage(
    transaction: Prisma.TransactionClient,
    membership: Awaited<ReturnType<typeof findMembership>>,
) {
    const { access } = await loadClubAccess(transaction, membership.club);
    return clubPermissions(membership.role, membership.club.lifecycle, access).manageSessions;
}

export const inviteInclude = {
    participant: {
        include: { session: true, membership: { include: { user: true, club: true } } },
    },
    inviter: { include: { user: true } },
} as const;
type TInvite = Prisma.SessionInviteGetPayload<{ include: typeof inviteInclude }>;

export function preview(invite: TInvite | null, userId: string): TSessionInvitationPreview {
    if (!invite) return { state: 'unavailable' };
    const { participant, inviter } = invite;
    const { membership, session } = participant;
    if (
        membership.userId !== userId ||
        membership.status !== 'ACTIVE' ||
        membership.user.status !== 'ACTIVE' ||
        membership.club.deletedAt ||
        membership.club.lifecycle !== 'ACTIVE' ||
        inviter.status !== 'ACTIVE' ||
        !isOpenSessionPhase(session.phase) ||
        invite.revokedAt
    )
        return { state: 'unavailable' };
    if (invite.respondedAt) {
        if (invite.accepted && participant.status === 'ACCEPTED')
            return { state: 'accepted', sessionId: session.id, clubId: session.clubId };
        if (!invite.accepted && participant.status === 'DECLINED') return { state: 'declined' };
        return { state: 'unavailable' };
    }
    if (invite.expiresAt <= new Date() || participant.status !== 'INVITED')
        return { state: 'unavailable' };
    return {
        state: 'valid',
        clubName: membership.club.name,
        topic: session.topic,
        scheduledAt: session.scheduledAt?.toISOString() ?? null,
        location: session.location,
        inviterName: inviter.user.displayName,
        expiresAt: invite.expiresAt.toISOString(),
    };
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
    member: Awaited<ReturnType<typeof findMembership>>,
) {
    if (member.role === 'MEMBER') throw new ForbiddenException();
    if (!(await canManage(transaction, member)))
        throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
}
export async function revokePending(tx: Prisma.TransactionClient, participantId: string) {
    await tx.sessionInvite.updateMany({
        where: { participantId, respondedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}
/** Records a roster event, then re-checks whether Nomination is complete. */
export async function rosterAudit(
    tx: Prisma.TransactionClient,
    event: TAuditEvent & { sessionId: string },
) {
    await recordAudit(tx, event);
    await completeNomination(tx, event.sessionId);
}
