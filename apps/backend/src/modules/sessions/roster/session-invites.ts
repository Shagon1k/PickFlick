import { isOpenSessionPhase, type TSessionInvitationPreview } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { recordAudit, type TAuditEvent } from '../../clubs/access/club-access.js';
import { completeNomination } from '../nominations/nomination-completion.js';

export const inviteInclude = {
    participant: {
        include: { session: true, membership: { include: { user: true, club: true } } },
    },
    inviter: { include: { user: true } },
} as const;
type TInvite = Prisma.SessionInviteGetPayload<{ include: typeof inviteInclude }>;

export function toInvitationPreview(
    invite: TInvite | null,
    userId: string,
): TSessionInvitationPreview {
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

export async function revokePendingInvites(tx: Prisma.TransactionClient, participantId: string) {
    await tx.sessionInvite.updateMany({
        where: { participantId, respondedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}
/** Records a roster event, then re-checks whether Nomination is complete. */
export async function recordRosterChange(
    tx: Prisma.TransactionClient,
    event: TAuditEvent & { sessionId: string },
) {
    await recordAudit(tx, event);
    await completeNomination(tx, event.sessionId);
}
