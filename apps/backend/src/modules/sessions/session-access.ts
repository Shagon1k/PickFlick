import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
    isOpenSessionPhase,
    type TClubLifecycle,
    type TClubRole,
    type TSessionPhase,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import {
    loadClubAccess,
    recordAudit,
    type TAuditEvent,
    type TMembership,
} from '../clubs/access/club-access.js';
import { getClubPermissions } from '../clubs/access/club-permissions.js';
import { getClubEntitlements } from '../clubs/access/club-tiers.js';

export async function canManage(transaction: Prisma.TransactionClient, membership: TMembership) {
    const { access } = await loadClubAccess(transaction, membership.club);
    return getClubPermissions(membership.role, membership.club.lifecycle, access).manageSessions;
}

export function assertOpen(phase: TSessionPhase) {
    if (!isOpenSessionPhase(phase)) throw new ConflictException({ reason: 'SESSION_CLOSED' });
}
/**
 * The one Session management rule: Admins and Moderators, in an active Club that has an Admin
 * and is within its member limit. Members get 403; a restricted Club gets `CLUB_READ_ONLY`.
 */
export async function assertManager(
    transaction: Prisma.TransactionClient,
    membership: TMembership,
) {
    if (membership.role === 'MEMBER') throw new ForbiddenException();
    if (!(await canManage(transaction, membership)))
        throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
}

export function canViewSelectionBreakdown(
    session: Pick<Prisma.SessionGetPayload<object>, 'clubId' | 'showVoteResults'>,
    membership: Pick<TMembership, 'role'>,
) {
    return (
        membership.role !== 'MEMBER' ||
        (getClubEntitlements(session.clubId).voteResultVisibility === 'ADMIN_CONFIGURABLE' &&
            session.showVoteResults)
    );
}

/** Joining needs an open Session in an active Club; accepted members are in, removed ones stay out. */
/**
 * A member's standing in a Session from all their participant rows. Leaving the Club and rejoining
 * creates a new Membership, but an earlier removal or accepted participation still applies.
 */
export function getOwnStatus(
    rows: readonly { membershipId: string; status: string }[],
    membershipId: string,
): string | undefined {
    const standing =
        rows.find(({ status }) => status === 'REMOVED') ??
        rows.find(({ status }) => status === 'ACCEPTED');
    return (standing ?? rows.find((row) => row.membershipId === membershipId))?.status;
}

/** Session removal follows the Club hierarchy: nobody removes the Admin; Moderators remove Members. */
export function canRemoveParticipant(actorRole: TClubRole, targetRole: TClubRole): boolean {
    return targetRole !== 'ADMIN' && (actorRole === 'ADMIN' || targetRole === 'MEMBER');
}

/** An operator removes someone else, within the Club hierarchy; their own exit is Leave. */
export function assertRemovable(
    actor: { id: string; role: TClubRole },
    target: { id: string; role: TClubRole },
) {
    if (target.id === actor.id) throw new ConflictException({ reason: 'USE_LEAVE' });
    if (!canRemoveParticipant(actor.role, target.role)) throw new ForbiddenException();
}

export function canJoinSession(input: {
    phase: TSessionPhase;
    clubLifecycle: TClubLifecycle;
    ownStatus: string | undefined;
}) {
    return (
        isOpenSessionPhase(input.phase) &&
        input.clubLifecycle === 'ACTIVE' &&
        input.ownStatus !== 'ACCEPTED' &&
        input.ownStatus !== 'REMOVED'
    );
}

/** A Session action the member took on their own behalf: they are both actor and subject. */
export async function recordSessionAction(
    transaction: Prisma.TransactionClient,
    sessionId: string,
    membership: TMembership,
    action: TAuditEvent['action'],
) {
    await recordAudit(transaction, {
        clubId: membership.club.id,
        sessionId,
        actorUserId: membership.userId,
        subjectUserId: membership.userId,
        subjectMembershipId: membership.id,
        action,
    });
}
