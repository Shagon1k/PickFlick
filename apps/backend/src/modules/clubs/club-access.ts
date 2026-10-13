import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IClubAccess, TClubLifecycle } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { clubEntitlements } from './club-tiers.js';

const clubColumns = {
    id: true,
    name: true,
    description: true,
    avatarObjectKey: true,
    lifecycle: true,
    selectionScaleMin: true,
    selectionScaleMax: true,
    showNominationAuthors: true,
    showNominationsBeforeSubmit: true,
    showVoteResults: true,
    showRatingResults: true,
    useMonochromeMedia: true,
} as const;

/**
 * The caller's active Membership in a live Club. A Club the caller cannot see is a 404, so the
 * response never reveals that it exists.
 */
export async function findMembership(
    database: Prisma.TransactionClient,
    userId: string,
    clubId: string,
) {
    const membership = await database.membership.findFirst({
        where: { userId, clubId, status: 'ACTIVE', club: { deletedAt: null } },
        select: { id: true, role: true, club: { select: clubColumns } },
    });
    if (!membership) {
        throw new NotFoundException();
    }
    return membership;
}

export type TMembership = Awaited<ReturnType<typeof findMembership>>;

export function assertAdmin(membership: TMembership): void {
    if (membership.role !== 'ADMIN') {
        throw new ForbiddenException();
    }
}

export function assertActive(membership: TMembership): void {
    if (membership.club.lifecycle !== 'ACTIVE') {
        throw new ConflictException({ reason: 'CLUB_ARCHIVED' });
    }
}

type TAuditEvent = Omit<Prisma.ClubAuditEventUncheckedCreateInput, 'id' | 'changed' | 'createdAt'>;

/** Appends one audit row for a change that actually happened. */
export async function recordAudit(
    transaction: Prisma.TransactionClient,
    event: TAuditEvent,
): Promise<void> {
    await transaction.clubAuditEvent.create({ data: { ...event, changed: true } });
}

/** Shares the invitation lock with membership and lifecycle writes before authorization is read. */
export async function lockClub(
    transaction: Prisma.TransactionClient,
    clubId: string,
): Promise<void> {
    await transaction.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId}::uuid FOR UPDATE`;
}

export function clubAccess(
    lifecycle: TClubLifecycle,
    hasAdmin: boolean,
    memberCount: number,
    memberLimit: number,
): IClubAccess {
    const reasons: IClubAccess['reasons'] = [];
    if (lifecycle === 'ARCHIVED') reasons.push('ARCHIVED');
    if (!hasAdmin) reasons.push('ADMINLESS');
    if (memberCount > memberLimit) reasons.push('MEMBER_LIMIT');
    return { adminless: !hasAdmin, newWorkAllowed: reasons.length === 0, reasons };
}

/** Counts active members and checks for an active Admin, then derives the Club's access state. */
export async function loadClubAccess(
    database: Prisma.TransactionClient,
    club: { id: string; lifecycle: TClubLifecycle },
): Promise<{ access: IClubAccess; memberCount: number }> {
    const [admin, memberCount] = await Promise.all([
        database.membership.findFirst({
            where: { clubId: club.id, role: 'ADMIN', status: 'ACTIVE' },
            select: { id: true },
        }),
        database.membership.count({ where: { clubId: club.id, status: 'ACTIVE' } }),
    ]);
    const { memberLimit } = clubEntitlements(club.id);
    return {
        access: clubAccess(club.lifecycle, Boolean(admin), memberCount, memberLimit),
        memberCount,
    };
}
