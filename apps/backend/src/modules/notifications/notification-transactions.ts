import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { NotificationSignals } from './notification-signals.js';
import { trackNotificationRecipients } from './notification-store.js';

@Injectable()
export class NotificationTransactions {
    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaClient,
        private readonly signals: NotificationSignals,
    ) {}

    async run<TResult>(
        action: (tx: Prisma.TransactionClient) => Promise<TResult>,
        options?: {
            isolationLevel?: Prisma.TransactionIsolationLevel;
            timeout?: number;
            maxWait?: number;
        },
    ): Promise<TResult> {
        const recipients = new Set<string>();
        const result = await this.prisma.$transaction(async (tx) => {
            trackNotificationRecipients(tx, recipients);
            return action(tx);
        }, options);
        // A rejected transaction never reaches Redis. Publishing cannot undo a committed action.
        if (recipients.size) await this.signals.publish(recipients);
        return result;
    }
}
