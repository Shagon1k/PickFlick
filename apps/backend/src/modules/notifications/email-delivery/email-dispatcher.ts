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
    type IEmailResult,
    MAX_ATTEMPTS,
    RETRY_WINDOW_MS,
    type TEmailClaim,
} from './email-store.js';
import { renderNotificationEmail, SUPPORT_EMAIL } from './email-template.js';

const OUTCOME_EVENTS: Record<IEmailResult['status'], string> = {
    ACCEPTED: 'email.accepted',
    PENDING: 'email.retry_scheduled',
    FAILED: 'email.failed',
    SUPPRESSED: 'email.suppressed',
};

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
            await this.finish(claim, { status: 'FAILED', reason: 'retry_window_exhausted' });
            return;
        }
        const message = await this.prepareMessageOrSkip(claim);
        if (!message) return;
        let providerId: string | void;
        try {
            providerId = await this.email.send(message);
            if (!providerId) throw new EmailDeliveryError('missing_provider_id', true);
        } catch (error) {
            await this.retryOrFail(claim, now, error);
            return;
        }
        await this.finish(claim, { status: 'ACCEPTED', reason: null, providerId });
    }

    private async retryOrFail(claim: TEmailClaim, now: Date, error: unknown) {
        const failure =
            error instanceof EmailDeliveryError
                ? error
                : new EmailDeliveryError('transport_unknown', true);
        const nextAttemptAt = failure.canRetry ? getRetryAt(claim, now) : null;
        await this.finish(
            claim,
            nextAttemptAt
                ? { status: 'PENDING', reason: failure.reason, nextAttemptAt }
                : { status: 'FAILED', reason: failure.reason },
        );
    }

    /** Builds the message, or closes the claim when the recipient lost access or is suppressed. */
    private async prepareMessageOrSkip(claim: TEmailClaim) {
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
            await this.finish(claim, { status: 'SUPPRESSED', reason: 'recipient_ineligible' });
            return null;
        }
        const recipientHash = hashEmailAddress(notification.recipient.email);
        if (
            await this.prisma.notificationEmailSuppression.findUnique({
                where: { addressHash: recipientHash },
            })
        ) {
            await this.finish(claim, { status: 'SUPPRESSED', reason: 'address_suppressed' });
            return null;
        }
        // The recipient hash marks the send as prepared, so a webhook racing the send response
        // can still find this delivery. A lost lease means another worker owns it now.
        const prepared = await this.prisma.notificationEmailDelivery.updateMany({
            where: {
                notificationId: claim.notificationId,
                claimToken: claim.claimToken,
                status: 'PROCESSING',
                leaseUntil: { gt: new Date() },
            },
            data: { recipientHash },
        });
        if (!prepared.count) return null;
        return {
            to: notification.recipient.email,
            ...renderNotificationEmail({ ...resolved, baseUrl: this.options.environment.baseUrl }),
            replyTo: SUPPORT_EMAIL,
            idempotencyKey: `notification/${notification.id}`,
            notificationId: notification.id,
        };
    }

    /** Records the outcome unless another worker already took over the expired claim. */
    private async finish(claim: TEmailClaim, outcome: Omit<IEmailResult, 'claim'>) {
        if (await finishEmail(this.prisma, { claim, ...outcome })) {
            this.options.log({
                event: OUTCOME_EVENTS[outcome.status],
                notificationId: claim.notificationId,
                attempt: claim.attemptCount,
                ...(outcome.reason ? { reason: outcome.reason } : {}),
            });
        }
    }
}
