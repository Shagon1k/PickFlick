import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { BillingService } from '../billing/billing.service.js';
import { BillingProviderError } from '../billing/billing.types.js';
import { StorageService } from '../storage/storage.service.js';

const SWEEP_INTERVAL_MS = 5000;
const RETRY_DELAY_MS = 60_000;
const STORAGE_TIMEOUT_MS = 10_000;
// Export workers have bounded uploads. Wait beyond their lease before removing tracked attempts.
const EXPORT_UPLOAD_GRACE_MS = 30_000;
type TDeletion = Prisma.AccountDeletionGetPayload<object>;

@Injectable()
export class AccountDeletionWorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AccountDeletionWorkerService.name);
    private timer?: ReturnType<typeof setInterval>;
    private cycle?: Promise<void>;

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly billing: BillingService,
    ) {}

    onModuleInit() {
        this.timer = setInterval(() => {
            void this.sweep();
        }, SWEEP_INTERVAL_MS);
        this.timer.unref();
    }
    async onModuleDestroy() {
        clearInterval(this.timer);
        await this.cycle;
    }
    async sweep(now = new Date()): Promise<void> {
        if (this.cycle) return this.cycle;
        this.cycle = this.runOnce(now).catch(() => {
            this.logger.error({ event: 'account.deletion.cycle.failed' });
        });
        try {
            await this.cycle;
        } finally {
            this.cycle = undefined;
        }
    }

    private async runOnce(now: Date) {
        await this.prisma.$transaction(
            async (tx) => {
                const [job] = await tx.$queryRaw<TDeletion[]>`SELECT * FROM "AccountDeletion"
                WHERE status = 'PENDING' AND "nextAttemptAt" <= ${now}
                ORDER BY "nextAttemptAt", "userId" FOR UPDATE SKIP LOCKED LIMIT 1`;
                if (!job) return;
                // One object per transaction bounds storage work and lets multiple API replicas sweep.
                try {
                    const isComplete = await this.cleanup(tx, job, now);
                    await tx.accountDeletion.update({
                        where: { userId: job.userId },
                        data: {
                            attemptCount: { increment: 1 },
                            failure: null,
                            status: isComplete ? 'COMPLETE' : 'PENDING',
                            completedAt: isComplete ? now : null,
                            nextAttemptAt: new Date(now.getTime() + SWEEP_INTERVAL_MS),
                        },
                    });
                    if (isComplete)
                        this.logger.log({ event: 'account.deletion.complete', userId: job.userId });
                } catch (error) {
                    // SQL errors abort this transaction; the outer catch logs and the row stays due.
                    // Storage errors carry no SQL failure and can persist a scheduled retry.
                    if (
                        !(
                            error instanceof StorageDeletionError ||
                            error instanceof BillingProviderError
                        )
                    )
                        throw error;
                    await tx.accountDeletion.update({
                        where: { userId: job.userId },
                        data: {
                            attemptCount: { increment: 1 },
                            failure:
                                error instanceof BillingProviderError
                                    ? error.reason
                                    : 'OBJECT_CLEANUP_FAILED',
                            nextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS),
                        },
                    });
                    this.logger.error({ event: 'account.deletion.retry', userId: job.userId });
                }
            },
            { timeout: STORAGE_TIMEOUT_MS + RETRY_DELAY_MS },
        );
    }

    private async cleanup(tx: Prisma.TransactionClient, job: TDeletion, now: Date) {
        if (!['CANCELLED', 'NOT_REQUIRED'].includes(job.billing)) {
            const billing = await this.billing.cancelForDeletion(tx, job.userId);
            await tx.accountDeletion.update({ where: { userId: job.userId }, data: { billing } });
        }
        if (job.avatarKey) {
            await this.removeObject(job.avatarKey);
            await tx.accountAvatarObject.deleteMany({ where: { key: job.avatarKey, user: null } });
            await tx.accountDeletion.update({
                where: { userId: job.userId },
                data: { avatarKey: null },
            });
            return false;
        }
        const activeExport = await tx.dataExportJob.findFirst({
            where: {
                userId: job.userId,
                leaseUntil: { gt: new Date(now.getTime() - EXPORT_UPLOAD_GRACE_MS) },
            },
        });
        if (activeExport) return false;
        await tx.dataExportJob.updateMany({
            where: { userId: job.userId },
            data: {
                status: 'EXPIRED',
                claimToken: null,
                leaseUntil: null,
            },
        });
        const object = await tx.dataExportObject.findFirst({
            where: { job: { userId: job.userId } },
        });
        if (object) {
            await this.removeObject(object.key);
            await tx.dataExportObject.deleteMany({ where: { key: object.key } });
            return false;
        }
        await tx.dataExportJob.deleteMany({ where: { userId: job.userId } });
        return true;
    }

    private async removeObject(key: string) {
        try {
            await this.storage.delete(key, AbortSignal.timeout(STORAGE_TIMEOUT_MS));
        } catch {
            throw new StorageDeletionError();
        }
    }
}
class StorageDeletionError extends Error {}
