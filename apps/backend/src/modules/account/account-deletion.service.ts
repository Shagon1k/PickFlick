import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { recordNotification } from '../notifications/notification-store.js';
import { Transactions } from '../notifications/transactions.js';
import { departSessions } from '../sessions/roster/session-departure.js';

const REAUTH_WINDOW_MS = 5 * 60_000;

@Injectable()
export class AccountDeletionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactions: Transactions,
    ) {}

    async prepare(user: IAuthUser) {
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
            const account = await tx.user.findUnique({
                where: { id: user.id, status: 'ACTIVE' },
                select: { id: true },
            });
            if (!account) throw new NotFoundException();
            const data = { sessionId: user.sessionId, requestedAt: new Date() };
            await tx.accountDeletion.upsert({
                where: { userId: user.id },
                create: { userId: user.id, ...data },
                update: data,
            });
        });
    }

    async accept(user: IAuthUser) {
        await this.transactions.write(async (tx) => {
            // Club commands lock Club first. Use the same order before ending Memberships.
            await tx.$queryRaw`SELECT id FROM "Club" WHERE id IN (
                SELECT "clubId" FROM "Membership" WHERE "userId" = ${user.id}::uuid
            ) ORDER BY id FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
            const account = await tx.user.findUnique({
                where: { id: user.id },
                select: { status: true, avatarObjectKey: true },
            });
            const job = await tx.accountDeletion.findUnique({ where: { userId: user.id } });
            if (!account) throw new NotFoundException();
            if (!job) throw new ConflictException({ reason: 'REAUTH_REQUIRED' });
            // A request already authorized by the guard can arrive after the first one commits.
            if (job.status !== 'AWAITING_REAUTH') return;
            const session = await tx.authSession.findUnique({ where: { id: user.sessionId } });
            if (
                account.status !== 'ACTIVE' ||
                !session ||
                session.userId !== user.id ||
                session.expiresAt <= new Date() ||
                session.id === job.sessionId ||
                session.createdAt <= job.requestedAt ||
                session.createdAt.getTime() < Date.now() - REAUTH_WINDOW_MS
            )
                throw new ConflictException({ reason: 'REAUTH_REQUIRED' });
            const now = new Date();
            await tx.accountDeletion.update({
                where: { userId: user.id },
                data: {
                    status: 'PENDING',
                    acceptedAt: now,
                    sessionId: null,
                    avatarKey: account.avatarObjectKey,
                    nextAttemptAt: now,
                    billing: (await tx.subscription.findUnique({ where: { userId: user.id } }))
                        ? 'PENDING'
                        : 'NOT_REQUIRED',
                },
            });
            await endMemberships(tx, user.id, now);
            await tx.user.update({
                where: { id: user.id },
                data: {
                    status: 'ANONYMIZED',
                    displayName: 'Deleted user',
                    email: `deleted-${user.id}@example.invalid`,
                    emailVerified: false,
                    image: null,
                    avatarObjectKey: null,
                    isAvatarRemoved: true,
                    appearance: {},
                    locale: 'en',
                    appRole: 'USER',
                },
            });
            await tx.authSession.deleteMany({ where: { userId: user.id } });
            await tx.providerAccount.deleteMany({ where: { userId: user.id } });
            await tx.personalMovieRating.deleteMany({ where: { userId: user.id } });
            await tx.watchlistItem.deleteMany({ where: { userId: user.id } });
            await tx.notification.deleteMany({ where: { recipientId: user.id } });
            await tx.notificationPreference.deleteMany({ where: { userId: user.id } });
            await tx.achievementAward.deleteMany({ where: { userId: user.id } });
            await tx.clubInvite.updateMany({
                where: {
                    OR: [{ inviterId: user.id }, { targetUserId: user.id }],
                    respondedAt: null,
                    revokedAt: null,
                },
                data: { revokedAt: now },
            });
        });
    }
}

async function endMemberships(tx: Prisma.TransactionClient, userId: string, now: Date) {
    const memberships = await tx.membership.findMany({ where: { userId, status: 'ACTIVE' } });
    for (const membership of memberships) {
        await tx.membership.update({
            where: { id: membership.id },
            data: { status: 'LEFT', leftAt: now },
        });
        await departSessions(tx, membership, userId, 'LEFT');
        await tx.clubAuditEvent.create({
            data: {
                clubId: membership.clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'ACCOUNT_DELETED',
                changed: true,
                previousRole: membership.role,
            },
        });
        if (membership.role !== 'ADMIN') continue;
        const members = await tx.membership.findMany({
            where: { clubId: membership.clubId, status: 'ACTIVE' },
            select: { userId: true },
        });
        for (const member of members)
            await recordNotification(tx, {
                recipientId: member.userId,
                event: 'CLUB_ADMIN_DELETED',
                sourceId: membership.id,
                clubId: membership.clubId,
            });
    }
}
