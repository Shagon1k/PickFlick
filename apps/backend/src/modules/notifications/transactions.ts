import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { NotificationSignals } from './notification-signals.js';
import { trackNotificationRecipients } from './notification-store.js';

type TTransactionOptions = Parameters<PrismaClient['$transaction']>[1];

/**
 * Every service transaction goes through here, so a reader sees whether it writes. Writes may record
 * Notifications (Club audit events do, see `recordAudit`); their recipients get an inbox refresh
 * signal only after the transaction commits.
 */
@Injectable()
export class Transactions {
    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaClient,
        private readonly signals: NotificationSignals,
    ) {}

    read<TResult>(
        action: (tx: Prisma.TransactionClient) => Promise<TResult>,
        options?: TTransactionOptions,
    ): Promise<TResult> {
        return this.prisma.$transaction(action, options);
    }

    async write<TResult>(
        action: (tx: Prisma.TransactionClient) => Promise<TResult>,
        options?: TTransactionOptions,
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
