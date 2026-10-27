import { Injectable, NotFoundException } from '@nestjs/common';
import type { TNotificationList, TNotificationListQuery } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { resolveNotification } from './notification-resolver.js';
import { NotificationSignals } from './notification-signals.js';

@Injectable()
export class InboxService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly signals: NotificationSignals,
    ) {}

    list(userId: string, query: TNotificationListQuery): Promise<TNotificationList> {
        return this.prisma.$transaction(
            async (tx) => {
                const where: Prisma.NotificationWhereInput = {
                    recipientId: userId,
                    inApp: true,
                    recipient: { status: 'ACTIVE' },
                };
                const unreadCount = await tx.notification.count({
                    where: { ...where, readAt: null },
                });
                if (query.cursor) {
                    const cursor = await tx.notification.findFirst({
                        where: { ...where, id: query.cursor },
                    });
                    if (!cursor) throw new NotFoundException();
                    where.OR = [
                        { createdAt: { lt: cursor.createdAt } },
                        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                    ];
                }
                const rows = await tx.notification.findMany({
                    where,
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    take: query.limit + 1,
                    select: { id: true },
                });
                const page = rows.slice(0, query.limit);
                const items = await Promise.all(
                    page.map(async (row) => (await resolveNotification(tx, userId, row.id))!),
                );
                return {
                    items,
                    unreadCount,
                    nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async markRead(userId: string, id?: string): Promise<void> {
        const where = {
            recipientId: userId,
            inApp: true,
            recipient: { status: 'ACTIVE' as const },
        };
        if (id && !(await this.prisma.notification.findFirst({ where: { ...where, id } }))) {
            throw new NotFoundException();
        }
        const changed = await this.prisma.notification.updateMany({
            where: { ...where, id, readAt: null },
            data: { readAt: new Date() },
        });
        if (changed.count) await this.signals.publish([userId]);
    }
}
