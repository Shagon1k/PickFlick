import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { OPEN_SESSION_PHASES } from '@pickflick/contracts';

import { lockKey } from '../../database/advisory-lock.js';
import { PrismaService } from '../../database/prisma.service.js';
import { departSessions } from '../sessions/session-departure.js';
import { lockSession } from '../sessions/session-lock.js';
import { completeNomination } from '../sessions/session-progress.js';
import { StorageService } from '../storage/storage.service.js';
import { assertActive, assertAdmin, findMembership, lockClub, recordAudit } from './club-access.js';
import { canRemoveMember } from './club-permissions.js';
import { clubEntitlements } from './club-tiers.js';
import { assertBelowAdminLimit } from './clubs.service.js';

function assertConfirmed(confirmation: string, expected: string): void {
    if (confirmation !== expected) {
        throw new ConflictException({ reason: 'CONFIRMATION_MISMATCH' });
    }
}

/** Archive, reactivate, leave, and delete. Each action is naturally idempotent. */
@Injectable()
export class ClubLifecycleService {
    private readonly logger = new Logger(ClubLifecycleService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    async archive(userId: string, clubId: string, confirmation: string): Promise<void> {
        assertConfirmed(confirmation, 'ARCHIVE');
        await this.setLifecycle(userId, clubId, 'ARCHIVED');
    }

    async reactivate(userId: string, clubId: string): Promise<void> {
        await this.setLifecycle(userId, clubId, 'ACTIVE');
    }

    async leave(userId: string, clubId: string, confirmation: string): Promise<void> {
        assertConfirmed(confirmation, 'LEAVE');
        await this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const membership = await findMembership(transaction, userId, clubId);
            if (membership.role === 'ADMIN') {
                throw new ConflictException({ reason: 'ADMIN_MUST_TRANSFER' });
            }
            await departSessions(transaction, membership.id, userId, 'LEFT');
            await transaction.membership.update({
                where: { id: membership.id },
                data: { status: 'LEFT', leftAt: new Date() },
            });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'MEMBERSHIP_LEFT',
                previousRole: membership.role,
            });
        });
    }

    async removeMember(
        userId: string,
        clubId: string,
        membershipId: string,
        confirmation: string,
    ): Promise<void> {
        assertConfirmed(confirmation, 'REMOVE');
        await this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const actor = await findMembership(transaction, userId, clubId);
            if (actor.role === 'MEMBER') throw new ForbiddenException();
            assertActive(actor);
            const target = await transaction.membership.findFirst({
                where: { id: membershipId, clubId },
            });
            if (!target || !canRemoveMember(actor, target, actor.club.lifecycle)) {
                throw new ConflictException({ reason: 'MEMBERSHIP_INELIGIBLE' });
            }
            if (target.status !== 'ACTIVE') return;
            await departSessions(transaction, target.id, userId, 'REMOVED');
            await transaction.membership.update({
                where: { id: target.id },
                data: { status: 'REMOVED', leftAt: new Date() },
            });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: target.userId,
                subjectMembershipId: target.id,
                action: 'MEMBERSHIP_REMOVED',
                previousRole: target.role,
            });
        });
    }

    /** Deletes an empty Club: members lose access, while the audit trail stays. */
    async delete(userId: string, clubId: string, confirmation: string): Promise<void> {
        const avatarKey = await this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const membership = await findMembership(transaction, userId, clubId);
            assertAdmin(membership);
            assertConfirmed(confirmation, membership.club.name);
            if ((await transaction.session.count({ where: { clubId } })) > 0) {
                throw new ConflictException({ reason: 'SESSION_HISTORY' });
            }
            const deletedAt = new Date();
            await transaction.club.update({
                where: { id: clubId },
                data: { deletedAt, lifecycle: 'ARCHIVED', avatarObjectKey: null },
            });
            await transaction.membership.updateMany({
                where: { clubId, status: 'ACTIVE' },
                data: { status: 'REMOVED', leftAt: deletedAt },
            });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'CLUB_DELETED',
            });
            return membership.club.avatarObjectKey;
        });
        if (avatarKey) {
            await this.storage.delete(avatarKey).catch((error: unknown) => {
                this.logger.error(`Deleted Club avatar cleanup failed: ${String(error)}`);
            });
        }
    }

    private async setLifecycle(
        userId: string,
        clubId: string,
        next: 'ACTIVE' | 'ARCHIVED',
    ): Promise<void> {
        await this.prisma.$transaction(async (transaction) => {
            if (next === 'ACTIVE') {
                await lockKey(transaction, `club-admin:${userId}`);
            }
            await lockClub(transaction, clubId);
            const membership = await findMembership(transaction, userId, clubId);
            assertAdmin(membership);
            const previous = membership.club.lifecycle;
            if (previous === next) {
                return;
            }
            if (next === 'ACTIVE') {
                await assertBelowAdminLimit(
                    transaction,
                    userId,
                    clubEntitlements(clubId).adminClubLimit,
                );
            }
            await transaction.club.update({ where: { id: clubId }, data: { lifecycle: next } });
            const sessions = await transaction.session.findMany({
                where: { clubId, phase: { in: [...OPEN_SESSION_PHASES] } },
                orderBy: { id: 'asc' },
                select: { id: true },
            });
            for (const session of sessions) {
                await lockSession(transaction, session.id);
                await completeNomination(transaction, session.id);
            }
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: next === 'ACTIVE' ? 'CLUB_REACTIVATED' : 'CLUB_ARCHIVED',
                previousLifecycle: previous,
                nextLifecycle: next,
            });
        });
    }
}
