import { createHash } from 'node:crypto';

import type { TEmailWorkerEnvironment } from '@pickflick/config/environment';
import type { PrismaClient } from '@pickflick/database';

import type { IEmailClient } from '../../email/email.types.js';
import { EmailDeliveryError } from '../../email/resend-email.client.js';
import { resolveNotification } from '../notification-resolver.js';
import { sendFailureAlert } from './email-alert.js';
import {
    claimEmail,
    finishEmail,
    getRetryAt,
    hashEmailAddress,
    MAX_ATTEMPTS,
    RETRY_WINDOW_MS,
    type TEmailClaim,
} from './email-store.js';
import { renderNotificationEmail } from './email-template.js';

function hashEmailValue(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

export interface IEmailDispatcherOptions {
    environment: TEmailWorkerEnvironment;
    log: (fields: {
        event: string;
        notificationId?: string;
        attempt?: number;
        reason?: string | null;
    }) => void;
}

export class EmailDispatcher {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly email: IEmailClient,
        private readonly options: IEmailDispatcherOptions,
    ) {}

    async runOnce(now = new Date(), signal?: AbortSignal) {
        if (!this.options.environment.deliveryEnabled || signal?.aborted) return;
        const claim = await claimEmail(this.prisma, now);
        if (claim) await this.deliver(claim, now);
        if (!signal?.aborted) await sendFailureAlert(this.prisma, this.email, this.options);
    }

    private async deliver(claim: TEmailClaim, now: Date) {
        if (
            claim.attemptCount > MAX_ATTEMPTS ||
            now.getTime() >= claim.firstAttemptAt.getTime() + RETRY_WINDOW_MS
        ) {
            await this.finish(claim, now, 'FAILED', 'retry_window_exhausted');
            return;
        }
        const message = await this.prepare(claim, now);
        if (!message) return;
        let providerId: string | void;
        try {
            providerId = await this.email.send(message);
            if (!providerId) throw new EmailDeliveryError('missing_provider_id', true);
        } catch (error) {
            await this.retryOrFail(claim, now, error);
            return;
        }
        if (
            await finishEmail(this.prisma, {
                claim,
                now,
                status: 'ACCEPTED',
                reason: null,
                providerId,
            })
        )
            this.options.log({
                event: 'email.accepted',
                notificationId: claim.notificationId,
                attempt: claim.attemptCount,
            });
    }
    private async retryOrFail(claim: TEmailClaim, now: Date, error: unknown) {
        const failure =
            error instanceof EmailDeliveryError
                ? error
                : new EmailDeliveryError('transport_unknown', true);
        const nextAttemptAt = failure.canRetry ? getRetryAt(claim, now) : null;
        if (nextAttemptAt) {
            if (
                await finishEmail(this.prisma, {
                    claim,
                    now,
                    status: 'PENDING',
                    reason: failure.reason,
                    nextAttemptAt,
                })
            )
                this.options.log({
                    event: 'email.retry_scheduled',
                    notificationId: claim.notificationId,
                    attempt: claim.attemptCount,
                    reason: failure.reason,
                });
        } else await this.finish(claim, now, 'FAILED', failure.reason);
    }

    private async prepare(claim: TEmailClaim, now: Date) {
        const notification = await this.prisma.notification.findUniqueOrThrow({
            where: { id: claim.notificationId },
            include: { recipient: true },
        });
        const resolved = await resolveNotification(
            this.prisma,
            notification.recipientId,
            notification.id,
        );
        if (!resolved) {
            await this.finish(claim, now, 'SUPPRESSED', 'recipient_ineligible');
            return null;
        }
        const recipientHash = hashEmailAddress(notification.recipient.email);
        if (
            await this.prisma.notificationEmailSuppression.findUnique({
                where: { addressHash: recipientHash },
            })
        ) {
            await this.finish(claim, now, 'SUPPRESSED', 'address_suppressed');
            return null;
        }
        const environment = this.options.environment;
        const message = {
            to: notification.recipient.email,
            ...renderNotificationEmail({ ...resolved, baseUrl: environment.baseUrl }),
            replyTo: 'hello@pick-flick.app',
            idempotencyKey: `notification/${notification.id}`,
            notificationId: notification.id,
        };
        const requestHash = hashEmailValue(JSON.stringify({ from: environment.from, ...message }));
        if (claim.requestHash && claim.requestHash !== requestHash) {
            await this.finish(claim, now, 'FAILED', 'request_changed');
            return null;
        }
        const prepared = await this.prisma.notificationEmailDelivery.updateMany({
            where: {
                notificationId: claim.notificationId,
                claimToken: claim.claimToken,
                status: 'PROCESSING',
                leaseUntil: { gt: new Date() },
            },
            data: { requestHash, recipientHash },
        });
        return prepared.count ? message : null;
    }

    private async finish(
        claim: TEmailClaim,
        now: Date,
        status: 'FAILED' | 'SUPPRESSED',
        reason: string,
    ) {
        if (await finishEmail(this.prisma, { claim, now, status, reason })) {
            this.options.log({
                event: `email.${status.toLowerCase()}`,
                notificationId: claim.notificationId,
                attempt: claim.attemptCount,
                reason,
            });
        }
    }
}
