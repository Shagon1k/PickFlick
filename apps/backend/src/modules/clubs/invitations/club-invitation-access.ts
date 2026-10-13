import type { TInvitationPreview } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { loadClubAccess } from '../access/club-access.js';
import { clubEntitlements } from '../access/club-tiers.js';

/** States decided by the link alone, before Membership or capacity is read. */
function closedState(
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
    const result = (preview: TInvitationPreview) => ({ invitation, preview });
    if (!invitation) return result({ state: 'invalid' });
    const closed = closedState(invitation, userId);
    if (closed) return result({ state: closed });
    const membership = await transaction.membership.findFirst({
        where: { clubId: invitation.clubId, userId, status: 'ACTIVE' },
        select: { id: true },
    });
    if (membership) return result({ state: 'already-member', clubId: invitation.clubId });
    if (invitation.respondedAt) {
        return result({
            state:
                invitation.responderId === userId && !invitation.accepted ? 'declined' : 'invalid',
        });
    }
    if (invitation.club.lifecycle !== 'ACTIVE') return result({ state: 'unavailable' });
    const { access, memberCount } = await loadClubAccess(transaction, invitation.club);
    if (access.adminless) return result({ state: 'unavailable' });
    if (memberCount >= clubEntitlements(invitation.clubId).memberLimit)
        return result({ state: 'over-limit' });
    return result({
        state: 'valid',
        clubName: invitation.club.name,
        memberCount,
        inviterName: invitation.inviter.displayName,
        expiresAt: invitation.expiresAt.toISOString(),
    });
}
