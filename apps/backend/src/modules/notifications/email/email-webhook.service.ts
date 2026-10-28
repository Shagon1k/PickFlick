import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import { emailWebhookEnvelopeSchema, emailWebhookSchema } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';
import { Resend } from 'resend';
import { z } from 'zod';

import { RUNTIME_ENVIRONMENT } from '../../../config/runtime.module.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { hashEmailValue } from './email-dispatcher.js';

interface IWebhookHeaders {
    id: string;
    timestamp: string;
    signature: string;
}
const WEBHOOK_TYPES = new Set<string>(emailWebhookSchema.shape.type.options);
const WEBHOOK_STATUSES = {
    'email.sent': 'ACCEPTED',
    'email.delivered': 'DELIVERED',
    'email.delivery_delayed': 'ACCEPTED',
    'email.bounced': 'SUPPRESSED',
    'email.complained': 'SUPPRESSED',
    'email.failed': 'FAILED',
    'email.suppressed': 'SUPPRESSED',
} as const;

@Injectable()
export class EmailWebhookService {
    private readonly logger = new Logger(EmailWebhookService.name);
    constructor(
        private readonly prisma: PrismaService,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async receive(payload: string, headers: IWebhookHeaders) {
        const secret = this.environment.resend.webhookSecret;
        if (!secret) throw new ServiceUnavailableException();
        let verified: unknown;
        try {
            verified = new Resend(this.environment.resend.apiKey).webhooks.verify({
                payload,
                headers,
                webhookSecret: secret,
            });
        } catch {
            throw new UnauthorizedException();
        }
        const envelope = emailWebhookEnvelopeSchema.safeParse(verified);
        if (!envelope.success) throw new BadRequestException();
        if (!WEBHOOK_TYPES.has(envelope.data.type)) return;
        const parsed = emailWebhookSchema.safeParse(verified);
        if (!parsed.success) throw new BadRequestException();
        const outcome = await this.prisma.$transaction((tx) =>
            applyWebhook(tx, parsed.data, headers.id),
        );
        if (outcome) this.logger.log(outcome);
    }
}

async function applyWebhook(
    tx: Prisma.TransactionClient,
    event: z.infer<typeof emailWebhookSchema>,
    receiptId: string,
) {
    const addressHash = hashEmailValue(event.data.to[0]!.trim().toLowerCase());
    const notificationId = z.uuid().safeParse(event.data.tags?.notification_id).data;

    const [receipt] = await tx.notificationEmailWebhook.createManyAndReturn({
        data: { id: receiptId, type: event.type },
        skipDuplicates: true,
    });
    if (!receipt) return null;
    // A signed tag also correlates callbacks racing the original send response.
    const delivery = await tx.notificationEmailDelivery.findFirst({
        where: {
            recipientHash: addressHash,
            requestHash: { not: null },
            OR: [
                { providerId: event.data.email_id },
                ...(notificationId ? [{ notificationId, providerId: null }] : []),
            ],
        },
    });
    if (!delivery) return null;
    await tx.$queryRaw`SELECT "notificationId" FROM "NotificationEmailDelivery"
                WHERE "notificationId" = ${delivery.notificationId}::uuid FOR UPDATE`;
    const current = await tx.notificationEmailDelivery.findUniqueOrThrow({
        where: { notificationId: delivery.notificationId },
    });
    if (current.providerId && current.providerId !== event.data.email_id) return null;
    const status = WEBHOOK_STATUSES[event.type];
    const isSuppression = status === 'SUPPRESSED';
    if (isSuppression) {
        await tx.notificationEmailSuppression.upsert({
            where: { addressHash },
            create: { addressHash, reason: event.type },
            update: {},
        });
    }
    // Delivery cannot undo a bounce/complaint/failure, and sent cannot undo delivered.
    if (
        current.status === 'SUPPRESSED' ||
        (current.status === 'FAILED' && current.reason === 'email.failed' && !isSuppression)
    )
        return null;
    if (current.status === 'DELIVERED' && status === 'ACCEPTED') return null;
    await tx.notificationEmailDelivery.update({
        where: { notificationId: delivery.notificationId },
        data: {
            providerId: event.data.email_id,
            status,
            claimToken: null,
            leaseUntil: null,
            reason:
                event.type === 'email.delivered' || event.type === 'email.sent' ? null : event.type,
        },
    });
    await tx.notificationDeliveryAttempt.updateMany({
        where: {
            notificationId: delivery.notificationId,
            channel: 'EMAIL',
            attempt: delivery.attemptCount,
        },
        data: { status, completedAt: new Date() },
    });
    return { notificationId: delivery.notificationId, event: event.type };
}
