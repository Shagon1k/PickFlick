import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import { BILLING_PROVIDER, type IBillingProvider } from '../billing.types.js';

@Injectable()
export class BillingEventsService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(BILLING_PROVIDER) private readonly provider: IBillingProvider,
    ) {}

    async receive(payload: Buffer, signature: string) {
        const event = this.provider.verifyWebhookEvent(payload, signature);
        const isIgnored = event.kind === 'IGNORED';
        await this.prisma.billingEvent.createMany({
            data: {
                ...event,
                provider: 'stripe',
                state: isIgnored ? 'IGNORED' : 'PENDING',
                processedAt: isIgnored ? new Date() : null,
            },
            skipDuplicates: true,
        });
    }
}
