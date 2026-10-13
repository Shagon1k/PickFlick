import { createHash } from 'node:crypto';

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TSessionInvitationPreview } from '@pickflick/contracts';
import { lockSession, type Prisma } from '@pickflick/database';

import { clubAccess, findMembership, lockClub, recordAudit } from '../clubs/club-access.js';
import { clubPermissions } from '../clubs/club-permissions.js';
import { clubEntitlements } from '../clubs/club-tiers.js';
import { completeNomination } from './session-progress.js';

export async function canManage(
    transaction: Prisma.TransactionClient,
    membership: Awaited<ReturnType<typeof findMembership>>,
) {
    const [admin, count] = await Promise.all([
        transaction.membership.findFirst({
            where: { clubId: membership.club.id, status: 'ACTIVE', role: 'ADMIN' },
        }),
        transaction.membership.count({ where: { clubId: membership.club.id, status: 'ACTIVE' } }),
    ]);
    const access = clubAccess(
        membership.club.lifecycle,
        Boolean(admin),
        count,
        clubEntitlements(membership.club.id).memberLimit,
    );
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

export async function access(tx: Prisma.TransactionClient, userId: string, id: string) {
    const initial = await tx.session.findUnique({ where: { id }, select: { clubId: true } });
    if (!initial) throw new NotFoundException();
    await lockClub(tx, initial.clubId);
    const member = await findMembership(tx, userId, initial.clubId);
    await lockSession(tx, id);
    return { session: await tx.session.findUniqueOrThrow({ where: { id } }), member };
}
export function assertOpen(phase: string) {
    if (!openPhases.some((value) => value === phase))
        throw new ConflictException({ reason: 'SESSION_CLOSED' });
}
export async function assertManager(
    tx: Prisma.TransactionClient,
    member: Awaited<ReturnType<typeof findMembership>>,
) {
    if (member.role === 'MEMBER') throw new ForbiddenException();
    if (!(await canManage(tx, member))) throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
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
    event: Parameters<typeof recordAudit>[1] & { sessionId: string },
) {
    await recordAudit(tx, event);
    await completeNomination(tx, event.sessionId);
}
