import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pickflick/database';

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
