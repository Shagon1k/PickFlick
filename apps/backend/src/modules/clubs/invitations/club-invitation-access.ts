import type { TInvitationPreview } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { loadClubAccess } from '../access/club-access.js';
import { getClubEntitlements } from '../access/club-tiers.js';

/** States decided by the link alone, before Membership or capacity is read. */
function getClosedState(
    invitation: {
        targetUserId: string | null;
        revokedAt: Date | null;
        expiresAt: Date;
        club: { deletedAt: Date | null };
    },
    userId: string,
): 'invalid' | 'revoked' | 'expired' | null {
    if (invitation.targetUserId && invitation.targetUserId !== userId) return 'invalid';
    if (invitation.club.deletedAt) return 'invalid';
    if (invitation.revokedAt) return 'revoked';
    return invitation.expiresAt <= new Date() ? 'expired' : null;
}

export async function inspectInvitation(
    transaction: Prisma.TransactionClient,
    userId: string,
    tokenDigest: string,
) {
    const invitation = await transaction.clubInvite.findUnique({
        where: { tokenDigest },
        include: { club: true, inviter: { select: { displayName: true } } },
    });
    const buildInspection = (preview: TInvitationPreview) => ({ invitation, preview });
    if (!invitation) return buildInspection({ state: 'invalid' });
    const closed = getClosedState(invitation, userId);
    if (closed) return buildInspection({ state: closed });
    const membership = await transaction.membership.findFirst({
        where: { clubId: invitation.clubId, userId, status: 'ACTIVE' },
        select: { id: true },
    });
    if (membership) return buildInspection({ state: 'already-member', clubId: invitation.clubId });
    if (invitation.respondedAt) {
        return buildInspection({
            state:
                invitation.responderId === userId && !invitation.accepted ? 'declined' : 'invalid',
        });
    }
    if (invitation.club.lifecycle !== 'ACTIVE') return buildInspection({ state: 'unavailable' });
    const { access, memberCount } = await loadClubAccess(transaction, invitation.club);
    if (access.adminless) return buildInspection({ state: 'unavailable' });
    if (memberCount >= getClubEntitlements(invitation.clubId).memberLimit)
        return buildInspection({ state: 'over-limit' });
    // A link lives only while its creator may still invite, as Session invites already require.
    const inviter = await transaction.membership.findFirst({
        where: {
            clubId: invitation.clubId,
            userId: invitation.inviterId,
            status: 'ACTIVE',
            role: { not: 'MEMBER' },
        },
        select: { id: true },
    });
    if (!inviter) return buildInspection({ state: 'revoked' });
    return buildInspection({
        state: 'valid',
        clubName: invitation.club.name,
        memberCount,
        inviterName: invitation.inviter.displayName,
        expiresAt: invitation.expiresAt.toISOString(),
    });
}
