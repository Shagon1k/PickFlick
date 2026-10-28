import type { PrismaClient } from '@pickflick/database';

import type { IEmailClient } from '../../email/email.types.js';
import type { IEmailDispatcherOptions } from './email-dispatcher.js';

export async function sendFailureAlert(
    prisma: PrismaClient,
    email: IEmailClient,
    options: IEmailDispatcherOptions,
) {
    const [failure] = await prisma.$queryRaw<{ notificationId: string }[]>`
        WITH due AS (
            SELECT "notificationId" FROM "NotificationEmailDelivery"
            WHERE ("status" = 'FAILED' OR ("status" = 'SUPPRESSED' AND "reason" IN
                ('email.bounced', 'email.complained', 'email.suppressed')))
                AND "alertAttemptedAt" IS NULL
            FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE "NotificationEmailDelivery" AS delivery SET "alertAttemptedAt" = NOW()
        FROM due WHERE delivery."notificationId" = due."notificationId"
        RETURNING delivery."notificationId"`;
    if (!failure) return;
    try {
        await email.send({
            to: options.environment.alertTo,
            subject: 'PickFlick notification email needs attention',
            text: `Notification ${failure.notificationId} has a final email failure. Inspect the delivery record and structured logs before any manual action.`,
            replyTo: 'hello@pick-flick.app',
            idempotencyKey: `notification-alert/${failure.notificationId}`,
        });
    } catch {
        options.log({ event: 'email.alert_failed', notificationId: failure.notificationId });
        return;
    }
    await prisma.notificationEmailDelivery.update({
        where: { notificationId: failure.notificationId },
        data: { alertSentAt: new Date() },
    });
    options.log({ event: 'email.alert_sent', notificationId: failure.notificationId });
}
