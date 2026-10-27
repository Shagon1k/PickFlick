import type { Prisma } from '@pickflick/database';

import { NOTIFICATION_MESSAGES } from './notification-policy.js';

const UNAVAILABLE = { message: 'This update is no longer available.', href: null };

/** Recheck current authorization before projecting either inbox copy or email content. */
export async function resolveNotification(
    tx: Prisma.TransactionClient,
    recipientId: string,
    notificationId: string,
) {
    const notification = await tx.notification.findFirst({
        where: { id: notificationId, recipientId, recipient: { status: 'ACTIVE' } },
    });
    if (!notification) return null;
    const target = await resolveTarget(tx, notification);
    return {
        id: notification.id,
        event: notification.event,
        createdAt: notification.createdAt.toISOString(),
        readAt: notification.readAt?.toISOString() ?? null,
        ...(target
            ? { message: NOTIFICATION_MESSAGES[notification.event], href: target }
            : UNAVAILABLE),
    };
}

async function resolveTarget(
    tx: Prisma.TransactionClient,
    notification: Prisma.NotificationGetPayload<object>,
): Promise<string | null> {
    if (notification.event === 'BILLING_SERVICE') return '/settings';
    let role: string | undefined;
    if (notification.clubId) {
        const member = await tx.membership.findFirst({
            where: {
                clubId: notification.clubId,
                userId: notification.recipientId,
                status: 'ACTIVE',
                club: { deletedAt: null },
            },
            select: { role: true },
        });
        if (!member) return null;
        role = member.role;
    }
    if (notification.awardId) {
        return resolveAwardTarget(tx, notification, role);
    }
    if (notification.sessionId) {
        const session = await tx.session.findFirst({
            where: { id: notification.sessionId, clubId: notification.clubId! },
            select: { id: true },
        });
        return session ? `/sessions/${session.id}` : null;
    }
    return notification.clubId ? `/clubs/${notification.clubId}` : null;
}

async function resolveAwardTarget(
    tx: Prisma.TransactionClient,
    notification: Prisma.NotificationGetPayload<object>,
    role?: string,
): Promise<string | null> {
    const award = await tx.achievementAward.findUnique({ where: { id: notification.awardId! } });
    if (!award || award.clubId !== notification.clubId) return null;
    if (award.userId !== null && award.userId !== notification.recipientId) return null;
    if (award.clubId && award.private && role !== 'ADMIN' && role !== 'MODERATOR') return null;
    return award.clubId ? `/clubs/${award.clubId}/achievements` : '/library?tab=achievements';
}
