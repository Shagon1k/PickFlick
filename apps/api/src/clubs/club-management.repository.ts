import { Injectable } from '@nestjs/common';

import { canonicalUuid } from '../common/validation/uuid.js';
import { lockKeys } from '../database/advisory-lock.js';
import { DatabaseService } from '../database/database.service.js';
import { ClubAuthorizationError, ClubConflictError } from './club.errors.js';
import {
    findActiveAdmin,
    readClubAvatarAccess,
    readClubManagementView,
} from './club-management.queries.js';
import { assertClubOperationReplay } from './club-operation-replay.js';
import type {
    ClubLifecycleInput,
    DeleteClubInput,
    FindAvatarReplayInput,
    LeaveClubInput,
    PersistClubSettingsInput,
    StoredClubAvatarAccess,
    StoredClubManagementView,
    UpdateAvatarReferenceInput,
} from './club-management.types.js';

export interface ClubManagementResult {
    readonly changed: boolean;
    readonly replayed: boolean;
}

export interface ClubAvatarReferenceResult extends ClubManagementResult {
    readonly currentObjectKey?: string;
    readonly previousObjectKey?: string;
}

export abstract class ClubManagementRepository {
    abstract readForUser(userId: string, clubId: string): Promise<StoredClubManagementView | null>;
    abstract readAvatarAccess(
        userId: string,
        clubId: string,
    ): Promise<StoredClubAvatarAccess | null>;
    abstract updateSettings(input: PersistClubSettingsInput): Promise<ClubManagementResult>;
    abstract changeLifecycle(input: ClubLifecycleInput): Promise<ClubManagementResult>;
    abstract leave(input: LeaveClubInput): Promise<ClubManagementResult>;
    abstract delete(input: DeleteClubInput): Promise<ClubAvatarReferenceResult>;
    abstract findAvatarReplay(
        input: FindAvatarReplayInput,
    ): Promise<ClubAvatarReferenceResult | null>;
    abstract updateAvatarReference(
        input: UpdateAvatarReferenceInput,
    ): Promise<ClubAvatarReferenceResult>;
}

@Injectable()
export class PrismaClubManagementRepository extends ClubManagementRepository {
    constructor(private readonly database: DatabaseService) {
        super();
    }

    async readForUser(userId: string, clubId: string): Promise<StoredClubManagementView | null> {
        return readClubManagementView(this.database.client, userId, clubId);
    }

    async readAvatarAccess(userId: string, clubId: string): Promise<StoredClubAvatarAccess | null> {
        return readClubAvatarAccess(this.database.client, userId, clubId);
    }

    async updateSettings(input: PersistClubSettingsInput): Promise<ClubManagementResult> {
        const actorUserId = canonicalUuid(input.actorUserId);
        const clubId = canonicalUuid(input.clubId);
        const operationId = canonicalUuid(input.operationId);
        return this.database.client.$transaction(async (transaction) => {
            await lockKeys(transaction, `club-operation:${operationId}`, `club:${clubId}`);
            const actor = await findActiveAdmin(transaction, actorUserId, clubId, true);
            const existing = await transaction.clubAuditEvent.findUnique({
                where: { operationId },
            });
            if (existing) {
                await assertClubOperationReplay(transaction, existing, {
                    action: 'CLUB_SETTINGS_UPDATED',
                    actorUserId,
                    clubId,
                    requestHash: input.requestHash,
                });
                return { changed: existing.changed, replayed: true };
            }
            if (input.voteResultVisibility !== 'ADMIN_CONFIGURABLE' && input.showVoteResults) {
                throw new ClubConflictError(
                    'TIER_SETTING_UNAVAILABLE',
                    'Vote-result visibility is not configurable on this Club tier.',
                );
            }
            const club = actor.club;
            const changed =
                club.name !== input.name ||
                (club.description ?? undefined) !== input.description ||
                club.selectionScaleMin !== input.selectionScaleMin ||
                club.selectionScaleMax !== input.selectionScaleMax ||
                club.showNominationAuthors !== input.showNominationAuthors ||
                club.showNominationsBeforeSubmit !== input.showNominationsBeforeSubmit ||
                club.showVoteResults !== input.showVoteResults ||
                club.showRatingResults !== input.showRatingResults ||
                club.useMonochromeMedia !== input.useMonochromeMedia;
            if (changed) {
                await transaction.club.update({
                    where: { id: clubId },
                    data: {
                        name: input.name,
                        description: input.description ?? null,
                        selectionScaleMin: input.selectionScaleMin,
                        selectionScaleMax: input.selectionScaleMax,
                        showNominationAuthors: input.showNominationAuthors,
                        showNominationsBeforeSubmit: input.showNominationsBeforeSubmit,
                        showVoteResults: input.showVoteResults,
                        showRatingResults: input.showRatingResults,
                        useMonochromeMedia: input.useMonochromeMedia,
                    },
                });
            }
            await transaction.clubAuditEvent.create({
                data: {
                    operationId,
                    requestHash: input.requestHash,
                    clubId,
                    actorUserId,
                    subjectUserId: actorUserId,
                    subjectMembershipId: actor.membershipId,
                    action: 'CLUB_SETTINGS_UPDATED',
                    changed,
                },
            });
            return { changed, replayed: false };
        });
    }

    async changeLifecycle(input: ClubLifecycleInput): Promise<ClubManagementResult> {
        const actorUserId = canonicalUuid(input.actorUserId);
        const clubId = canonicalUuid(input.clubId);
        const operationId = canonicalUuid(input.operationId);
        const auditAction = input.action === 'archive' ? 'CLUB_ARCHIVED' : 'CLUB_REACTIVATED';
        const nextLifecycle = input.action === 'archive' ? 'ARCHIVED' : 'ACTIVE';
        return this.database.client.$transaction(async (transaction) => {
            await lockKeys(
                transaction,
                `club-operation:${operationId}`,
                ...(input.action === 'reactivate' ? [`club-creation:${actorUserId}`] : []),
                `club:${clubId}`,
            );
            const existing = await transaction.clubAuditEvent.findUnique({
                where: { operationId },
            });
            if (existing) {
                await assertClubOperationReplay(transaction, existing, {
                    action: auditAction,
                    actorUserId,
                    clubId,
                    requestHash: input.requestHash,
                });
                return { changed: existing.changed, replayed: true };
            }
            const actor = await findActiveAdmin(transaction, actorUserId, clubId, false);
            const previousLifecycle = actor.club.lifecycle;
            const changed = previousLifecycle !== nextLifecycle;
            if (changed && input.action === 'reactivate') {
                const activeAdminClubCount = await transaction.membership.count({
                    where: {
                        userId: actorUserId,
                        role: 'ADMIN',
                        status: 'ACTIVE',
                        club: { deletedAt: null, lifecycle: 'ACTIVE' },
                    },
                });
                if (activeAdminClubCount >= input.adminClubLimit) {
                    throw new ClubConflictError(
                        'ADMIN_CLUB_LIMIT_REACHED',
                        'The current User has reached the administered Club limit.',
                    );
                }
            }
            if (changed) {
                await transaction.club.update({
                    where: { id: clubId },
                    data: { lifecycle: nextLifecycle },
                });
            }
            await transaction.clubAuditEvent.create({
                data: {
                    operationId,
                    requestHash: input.requestHash,
                    clubId,
                    actorUserId,
                    subjectUserId: actorUserId,
                    subjectMembershipId: actor.membershipId,
                    action: auditAction,
                    changed,
                    previousLifecycle,
                    nextLifecycle,
                },
            });
            return { changed, replayed: false };
        });
    }

    async leave(input: LeaveClubInput): Promise<ClubManagementResult> {
        const actorUserId = canonicalUuid(input.actorUserId);
        const clubId = canonicalUuid(input.clubId);
        const operationId = canonicalUuid(input.operationId);
        return this.database.client.$transaction(async (transaction) => {
            await lockKeys(transaction, `club-operation:${operationId}`, `club:${clubId}`);
            const existing = await transaction.clubAuditEvent.findUnique({
                where: { operationId },
            });
            if (existing) {
                await assertClubOperationReplay(transaction, existing, {
                    action: 'MEMBERSHIP_LEFT',
                    actorUserId,
                    clubId,
                    requestHash: input.requestHash,
                });
                return { changed: existing.changed, replayed: true };
            }
            const actor = await transaction.user.findUnique({
                where: { id: actorUserId },
                select: {
                    status: true,
                    memberships: {
                        where: { clubId, status: 'ACTIVE', club: { deletedAt: null } },
                        take: 1,
                        select: { id: true, role: true },
                    },
                },
            });
            const membership = actor?.memberships[0];
            if (actor?.status !== 'ACTIVE' || !membership) {
                throw new ClubAuthorizationError('The current User cannot leave this Club.');
            }
            if (membership.role === 'ADMIN') {
                throw new ClubConflictError(
                    'ADMIN_MUST_TRANSFER',
                    'A Club Admin must transfer administration or delete the Club before leaving.',
                );
            }
            await transaction.membership.update({
                where: { id: membership.id },
                data: { status: 'LEFT', leftAt: new Date() },
            });
            await transaction.clubAuditEvent.create({
                data: {
                    operationId,
                    requestHash: input.requestHash,
                    clubId,
                    actorUserId,
                    subjectUserId: actorUserId,
                    subjectMembershipId: membership.id,
                    action: 'MEMBERSHIP_LEFT',
                    changed: true,
                    previousRole: membership.role,
                },
            });
            return { changed: true, replayed: false };
        });
    }

    async delete(input: DeleteClubInput): Promise<ClubAvatarReferenceResult> {
        const actorUserId = canonicalUuid(input.actorUserId);
        const clubId = canonicalUuid(input.clubId);
        const operationId = canonicalUuid(input.operationId);
        return this.database.client.$transaction(async (transaction) => {
            await lockKeys(transaction, `club-operation:${operationId}`, `club:${clubId}`);
            const existing = await transaction.clubAuditEvent.findUnique({
                where: { operationId },
            });
            if (existing) {
                await assertClubOperationReplay(transaction, existing, {
                    action: 'CLUB_DELETED',
                    actorUserId,
                    clubId,
                    requestHash: input.requestHash,
                });
                return { changed: existing.changed, replayed: true };
            }
            const actor = await findActiveAdmin(transaction, actorUserId, clubId, false);
            if (input.confirmation !== actor.club.name) {
                throw new ClubConflictError(
                    'CONFIRMATION_MISMATCH',
                    'The Club name confirmation does not match.',
                );
            }
            if (await transaction.session.count({ where: { clubId } })) {
                throw new ClubConflictError(
                    'SESSION_HISTORY',
                    'A Club with Session history cannot be deleted.',
                );
            }
            const deletedAt = new Date();
            await transaction.club.update({
                where: { id: clubId },
                data: { avatarObjectKey: null, deletedAt, lifecycle: 'ARCHIVED' },
            });
            await transaction.membership.updateMany({
                where: { clubId, status: 'ACTIVE' },
                data: { status: 'REMOVED', leftAt: deletedAt },
            });
            await transaction.clubAuditEvent.create({
                data: {
                    operationId,
                    requestHash: input.requestHash,
                    clubId,
                    actorUserId,
                    subjectUserId: actorUserId,
                    subjectMembershipId: actor.membershipId,
                    action: 'CLUB_DELETED',
                    changed: true,
                },
            });
            return {
                changed: true,
                replayed: false,
                ...(actor.club.avatarObjectKey
                    ? { previousObjectKey: actor.club.avatarObjectKey }
                    : {}),
            };
        });
    }

    async updateAvatarReference(
        input: UpdateAvatarReferenceInput,
    ): Promise<ClubAvatarReferenceResult> {
        const actorUserId = canonicalUuid(input.actorUserId);
        const clubId = canonicalUuid(input.clubId);
        const operationId = canonicalUuid(input.operationId);
        return this.database.client.$transaction(async (transaction) => {
            await lockKeys(transaction, `club-operation:${operationId}`, `club:${clubId}`);
            const existing = await transaction.clubAuditEvent.findUnique({
                where: { operationId },
            });
            if (existing) {
                await assertClubOperationReplay(transaction, existing, {
                    action: 'CLUB_AVATAR_UPDATED',
                    actorUserId,
                    clubId,
                    requestHash: input.requestHash,
                });
                const current = await transaction.club.findUnique({
                    where: { id: clubId },
                    select: { avatarObjectKey: true },
                });
                return {
                    changed: existing.changed,
                    replayed: true,
                    ...(current?.avatarObjectKey
                        ? { currentObjectKey: current.avatarObjectKey }
                        : {}),
                };
            }
            const actor = await findActiveAdmin(transaction, actorUserId, clubId, true);
            const previousObjectKey = actor.club.avatarObjectKey ?? undefined;
            const changed = previousObjectKey !== (input.objectKey ?? undefined);
            if (changed) {
                await transaction.club.update({
                    where: { id: clubId },
                    data: { avatarObjectKey: input.objectKey },
                });
            }
            await transaction.clubAuditEvent.create({
                data: {
                    operationId,
                    requestHash: input.requestHash,
                    clubId,
                    actorUserId,
                    subjectUserId: actorUserId,
                    subjectMembershipId: actor.membershipId,
                    action: 'CLUB_AVATAR_UPDATED',
                    changed,
                },
            });
            return {
                changed,
                replayed: false,
                ...(input.objectKey ? { currentObjectKey: input.objectKey } : {}),
                ...(previousObjectKey ? { previousObjectKey } : {}),
            };
        });
    }

    async findAvatarReplay(
        input: FindAvatarReplayInput,
    ): Promise<ClubAvatarReferenceResult | null> {
        const actorUserId = canonicalUuid(input.actorUserId);
        const clubId = canonicalUuid(input.clubId);
        const operationId = canonicalUuid(input.operationId);
        return this.database.client.$transaction(async (transaction) => {
            const existing = await transaction.clubAuditEvent.findUnique({
                where: { operationId },
            });
            if (!existing) {
                return null;
            }
            await assertClubOperationReplay(transaction, existing, {
                action: 'CLUB_AVATAR_UPDATED',
                actorUserId,
                clubId,
                requestHash: input.requestHash,
            });
            const current = await transaction.club.findUnique({
                where: { id: clubId },
                select: { avatarObjectKey: true },
            });
            return {
                changed: existing.changed,
                replayed: true,
                ...(current?.avatarObjectKey ? { currentObjectKey: current.avatarObjectKey } : {}),
            };
        });
    }
}
