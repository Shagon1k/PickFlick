import type { TNotificationEvent } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { getNotificationPolicy } from './notification-policy.js';

// Recipients collected per open write transaction; `Transactions.write` signals them after commit.
const pendingRecipients = new WeakMap<Prisma.TransactionClient, Set<string>>();

export function trackNotificationRecipients(tx: Prisma.TransactionClient, recipients: Set<string>) {
    pendingRecipients.set(tx, recipients);
}

export interface INotificationInput {
    recipientId: string;
    event: TNotificationEvent;
    sourceId: string;
    occurrence?: number;
    clubId?: string;
    sessionId?: string;
    awardId?: string;
}

/**
 * Record inside the source's `Transactions.write` callback so intent is atomic
 * and signals follow commit.
 */
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
    if (policy.email) {
        await tx.notificationEmailDelivery.create({ data: { notificationId: created.id } });
    }
    if (created.inApp) pendingRecipients.get(tx)?.add(created.recipientId);
    return created;
}
