import type { TNotificationEvent } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { getNotificationPolicy } from './notification-policy.js';

export interface INotificationInput {
    recipientId: string;
    event: TNotificationEvent;
    sourceId: string;
    occurrence?: number;
    clubId?: string;
    sessionId?: string;
    awardId?: string;
}

/** Call inside the source transaction so failed domain writes cannot leave delivery intent. */
export async function recordNotification(tx: Prisma.TransactionClient, input: INotificationInput) {
    const user = await tx.user.findFirst({
        where: { id: input.recipientId, status: 'ACTIVE' },
        select: { id: true },
    });
    if (!user) return null;
    const preference = await tx.notificationPreference.findUnique({
        where: { userId_event: { userId: input.recipientId, event: input.event } },
    });
    const policy = getNotificationPolicy(input.event, preference);
    const key = {
        recipientId: input.recipientId,
        event: input.event,
        sourceId: input.sourceId,
        occurrence: input.occurrence ?? 1,
    };
    // INSERT ON CONFLICT handles concurrent source retries without aborting their transactions.
    const [created] = await tx.notification.createManyAndReturn({
        data: { ...input, ...key, inApp: policy.inApp, email: policy.email },
        skipDuplicates: true,
    });
    if (!created) {
        return tx.notification.findUniqueOrThrow({
            where: { recipientId_event_sourceId_occurrence: key },
        });
    }
    const now = new Date();
    await tx.notificationDeliveryAttempt.createMany({
        data: [
            {
                notificationId: created.id,
                channel: 'IN_APP',
                attempt: 1,
                status: policy.inApp ? 'DELIVERED' : 'SUPPRESSED',
                completedAt: now,
            },
            {
                notificationId: created.id,
                channel: 'EMAIL',
                attempt: 1,
                status: policy.email ? 'PENDING' : 'SUPPRESSED',
                completedAt: policy.email ? null : now,
            },
        ],
    });
    return created;
}
