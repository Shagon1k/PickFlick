import { createHash } from 'node:crypto';

import type { Prisma } from '@pickflick/database';

import { canonicalUuid } from '../common/validation/uuid.js';
import type { DatabaseService } from '../database/database.service.js';
import { ClubAuthorizationError, ClubConflictError } from './club.errors.js';
import type { StoredClubAvatarAccess, StoredClubManagementView } from './club-management.types.js';

type DatabaseClient = DatabaseService['client'];

function avatarVersion(objectKey: string): string {
    return createHash('sha256').update(objectKey).digest('hex').slice(0, 16);
}

export async function readClubManagementView(
    database: DatabaseClient,
    userId: string,
    clubId: string,
): Promise<StoredClubManagementView | null> {
    const canonicalUserId = canonicalUuid(userId);
    const canonicalClubId = canonicalUuid(clubId);
    const user = await database.user.findUnique({
        where: { id: canonicalUserId },
        select: {
            appRole: true,
            status: true,
            memberships: {
                where: { clubId: canonicalClubId, status: 'ACTIVE', club: { deletedAt: null } },
                take: 1,
                select: {
                    role: true,
                    club: {
                        select: {
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
                            memberships: {
                                where: { status: 'ACTIVE' },
                                orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
                                select: {
                                    id: true,
                                    role: true,
                                    joinedAt: true,
                                    user: { select: { displayName: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    const membership = user?.memberships[0];
    if (!user || user.status !== 'ACTIVE' || !membership) {
        return null;
    }
    const club = membership.club;
    const auditEvents =
        membership.role === 'ADMIN'
            ? await database.clubAuditEvent.findMany({
                  where: { clubId: canonicalClubId },
                  orderBy: { createdAt: 'desc' },
                  take: 20,
                  select: {
                      id: true,
                      action: true,
                      changed: true,
                      createdAt: true,
                  },
              })
            : [];
    return {
        subject: {
            appRole: user.appRole,
            clubRole: membership.role,
            lifecycle: club.lifecycle,
            userStatus: user.status,
        },
        club: {
            id: club.id,
            name: club.name,
            ...(club.description ? { description: club.description } : {}),
            hasAvatar: Boolean(club.avatarObjectKey),
            ...(club.avatarObjectKey ? { avatarVersion: avatarVersion(club.avatarObjectKey) } : {}),
            lifecycle: club.lifecycle,
            membershipRole: membership.role,
            selectionScaleMin: club.selectionScaleMin as 0 | 1,
            selectionScaleMax: club.selectionScaleMax,
        },
        visibility: {
            showNominationAuthors: club.showNominationAuthors,
            showNominationsBeforeSubmit: club.showNominationsBeforeSubmit,
            showVoteResults: club.showVoteResults,
            showRatingResults: club.showRatingResults,
            useMonochromeMedia: club.useMonochromeMedia,
        },
        members: club.memberships.map((current) => ({
            id: current.id,
            displayName: current.user.displayName,
            role: current.role,
            joinedAt: current.joinedAt.toISOString(),
        })),
        auditEvents: auditEvents.map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
        })),
    };
}

export async function readClubAvatarAccess(
    database: DatabaseClient,
    userId: string,
    clubId: string,
): Promise<StoredClubAvatarAccess | null> {
    const user = await database.user.findUnique({
        where: { id: canonicalUuid(userId) },
        select: {
            appRole: true,
            status: true,
            memberships: {
                where: {
                    clubId: canonicalUuid(clubId),
                    status: 'ACTIVE',
                    club: { deletedAt: null },
                },
                take: 1,
                select: {
                    role: true,
                    club: { select: { avatarObjectKey: true, lifecycle: true } },
                },
            },
        },
    });
    const membership = user?.memberships[0];
    if (!user || user.status !== 'ACTIVE' || !membership) {
        return null;
    }
    return {
        subject: {
            appRole: user.appRole,
            clubRole: membership.role,
            lifecycle: membership.club.lifecycle,
            userStatus: user.status,
        },
        ...(membership.club.avatarObjectKey
            ? { avatarObjectKey: membership.club.avatarObjectKey }
            : {}),
    };
}

/** The actor's active Admin Membership, or an authorization or archived-Club rejection. */
export async function findActiveAdmin(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    clubId: string,
    requireActiveClub: boolean,
) {
    const actor = await transaction.user.findUnique({
        where: { id: actorUserId },
        select: {
            status: true,
            memberships: {
                where: { clubId, status: 'ACTIVE' },
                take: 1,
                select: {
                    id: true,
                    role: true,
                    club: {
                        select: {
                            name: true,
                            lifecycle: true,
                            deletedAt: true,
                            avatarObjectKey: true,
                            description: true,
                            selectionScaleMin: true,
                            selectionScaleMax: true,
                            showNominationAuthors: true,
                            showNominationsBeforeSubmit: true,
                            showVoteResults: true,
                            showRatingResults: true,
                            useMonochromeMedia: true,
                        },
                    },
                },
            },
        },
    });
    const membership = actor?.memberships[0];
    if (actor?.status !== 'ACTIVE' || membership?.role !== 'ADMIN' || membership.club.deletedAt) {
        throw new ClubAuthorizationError('The current User cannot manage this Club.');
    }
    if (requireActiveClub && membership.club.lifecycle !== 'ACTIVE') {
        throw new ClubConflictError(
            'CLUB_ARCHIVED',
            'Archived Clubs are read-only until reactivated.',
        );
    }
    return { membershipId: membership.id, club: membership.club };
}
