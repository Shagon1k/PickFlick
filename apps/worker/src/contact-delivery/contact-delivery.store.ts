import { createDatabaseClient } from '@pickflick/database';
import type { ApplicationLogger } from '@pickflick/observability';

import { CONTACT_DELIVERY_MAX_ATTEMPTS } from './contact-delivery.constants.js';
import { ContactDeliveryClaimLostError } from './contact-delivery.errors.js';
import { ContactDeliveryStore, type ContactDeliveryRecord } from './contact-delivery.types.js';

export class PrismaContactDeliveryStore extends ContactDeliveryStore {
    constructor(
        private readonly database: ReturnType<typeof createDatabaseClient>,
        private readonly logger?: ApplicationLogger,
    ) {
        super();
    }

    async claim(now: Date): Promise<ContactDeliveryRecord | undefined> {
        const leaseUntil = new Date(now.getTime() + 60_000);
        const exhausted = await this.database.contactMessage.updateMany({
            where: {
                deliveryState: 'PROCESSING',
                processingLeaseUntil: { lte: now },
                attemptCount: { gte: CONTACT_DELIVERY_MAX_ATTEMPTS },
            },
            data: {
                deliveryState: 'FAILED',
                deliveryErrorCode: 'LEASE_EXPIRED',
                processingLeaseUntil: null,
                message: null,
                name: null,
                email: null,
            },
        });
        if (exhausted.count > 0) {
            this.logger?.error(
                { event: 'contact.delivery.lease_exhausted', messageCount: exhausted.count },
                'Contact delivery reached terminal failure after an expired final-attempt lease.',
            );
        }

        while (true) {
            const candidate = await this.database.contactMessage.findFirst({
                where: {
                    attemptCount: { lt: CONTACT_DELIVERY_MAX_ATTEMPTS },
                    OR: [
                        { deliveryState: 'PENDING', nextAttemptAt: { lte: now } },
                        { deliveryState: 'PROCESSING', processingLeaseUntil: { lte: now } },
                    ],
                },
                orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
                select: { id: true, attemptCount: true },
            });
            if (!candidate) {
                return undefined;
            }

            const claimed = await this.database.contactMessage.updateMany({
                where: {
                    id: candidate.id,
                    attemptCount: candidate.attemptCount,
                    OR: [
                        { deliveryState: 'PENDING', nextAttemptAt: { lte: now } },
                        { deliveryState: 'PROCESSING', processingLeaseUntil: { lte: now } },
                    ],
                },
                data: {
                    deliveryState: 'PROCESSING',
                    attemptCount: { increment: 1 },
                    processingLeaseUntil: leaseUntil,
                    deliveryErrorCode: null,
                },
            });
            if (claimed.count === 0) {
                continue;
            }

            const record = await this.database.contactMessage.findUnique({
                where: { id: candidate.id },
                select: { id: true, message: true, name: true, email: true, attemptCount: true },
            });
            if (!record?.message) {
                throw new ContactDeliveryClaimLostError();
            }
            return { ...record, message: record.message };
        }
    }

    async complete(
        id: string,
        attemptCount: number,
        providerMessageId: string,
        now: Date,
    ): Promise<void> {
        const result = await this.database.contactMessage.updateMany({
            where: { id, deliveryState: 'PROCESSING', attemptCount },
            data: {
                deliveryState: 'DELIVERED',
                providerMessageId,
                deliveryErrorCode: null,
                processingLeaseUntil: null,
                deliveredAt: now,
                message: null,
                name: null,
                email: null,
            },
        });
        if (result.count !== 1) {
            throw new ContactDeliveryClaimLostError();
        }
    }

    async fail(
        id: string,
        attemptCount: number,
        errorCode: string,
        nextAttemptAt: Date | undefined,
    ): Promise<void> {
        const terminal = nextAttemptAt === undefined;
        const result = await this.database.contactMessage.updateMany({
            where: { id, deliveryState: 'PROCESSING', attemptCount },
            data: {
                deliveryState: terminal ? 'FAILED' : 'PENDING',
                deliveryErrorCode: errorCode,
                processingLeaseUntil: null,
                ...(nextAttemptAt ? { nextAttemptAt } : { message: null, name: null, email: null }),
            },
        });
        if (result.count !== 1) {
            throw new ContactDeliveryClaimLostError();
        }
    }
}
