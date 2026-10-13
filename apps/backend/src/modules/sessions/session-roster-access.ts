import { createHash } from 'node:crypto';

import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { TSessionInvitationPreview } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { type findMembership, loadClubAccess, recordAudit } from '../clubs/club-access.js';
import { clubPermissions } from '../clubs/club-permissions.js';
import { completeNomination } from './session-progress.js';

export async function canManage(
    transaction: Prisma.TransactionClient,
    membership: Awaited<ReturnType<typeof findMembership>>,
) {
    const { access } = await loadClubAccess(transaction, membership.club);
    return clubPermissions(membership.role, membership.club.lifecycle, access).manageSessions;
}

export const openPhases = ['NOMINATION', 'SELECTION', 'WATCHING', 'RATING'] as const;
export const digest = (token: string) => createHash('sha256').update(token).digest('hex');
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
        !openPhases.some((phase) => phase === session.phase) ||
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
    if (!openPhases.some((value) => value === phase))
        throw new ConflictException({ reason: 'SESSION_CLOSED' });
}
export function assertManager(member: Awaited<ReturnType<typeof findMembership>>, phase: string) {
    if (member.role === 'MEMBER') throw new ForbiddenException();
    assertOpen(phase);
    if (member.club.lifecycle !== 'ACTIVE')
        throw new ConflictException({ reason: 'CLUB_ARCHIVED' });
}
export function invitationState(invite: {
    respondedAt: Date | null;
    accepted: boolean | null;
    revokedAt: Date | null;
    expiresAt: Date;
}) {
    if (invite.revokedAt) return 'revoked';
    if (invite.respondedAt) return invite.accepted ? 'accepted' : 'declined';
    return invite.expiresAt <= new Date() ? 'expired' : 'pending';
}
export async function revokePending(tx: Prisma.TransactionClient, participantId: string) {
    await tx.sessionInvite.updateMany({
        where: { participantId, respondedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}
export async function rosterAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    subjectUserId: string,
    subjectMembershipId: string,
    clubId: string,
    sessionId: string,
    action: Prisma.ClubAuditEventUncheckedCreateInput['action'],
) {
    await recordAudit(tx, {
        actorUserId,
        subjectUserId,
        subjectMembershipId,
        clubId,
        sessionId,
        action,
    });
    await completeNomination(tx, sessionId);
}
