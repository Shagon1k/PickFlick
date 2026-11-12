import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

const CLEANUP_INTERVAL_MS = 10 * 60_000;
const ABANDONED_UPLOAD_AGE_MS = 60 * 60_000;
const CLEANUP_BATCH_SIZE = 100;

@Injectable()
export class AvatarCleanupService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AvatarCleanupService.name);
    private timer?: ReturnType<typeof setInterval>;
    private isRunning = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    onModuleInit() {
        this.timer = setInterval(() => {
            void this.sweep();
        }, CLEANUP_INTERVAL_MS);
        this.timer.unref();
    }
    onModuleDestroy() {
        clearInterval(this.timer);
    }

    async remove(key: string): Promise<void> {
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT key FROM "AccountAvatarObject" WHERE key = ${key} FOR UPDATE`;
                const object = await tx.accountAvatarObject.findUnique({
                    where: { key },
                    select: { user: { select: { id: true } } },
                });
                if (object?.user) return;
                await this.storage.delete(key);
                await tx.accountAvatarObject.deleteMany({ where: { key } });
            });
        } catch {
            // Keep the tracking row so a storage outage is retried by the bounded sweep.
            this.logger.error('Account avatar cleanup failed; scheduled for retry.');
        }
    }

    async sweep(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;
        try {
            const objects = await this.prisma.accountAvatarObject.findMany({
                where: {
                    user: null,
                    createdAt: { lt: new Date(Date.now() - ABANDONED_UPLOAD_AGE_MS) },
                },
                take: CLEANUP_BATCH_SIZE,
                orderBy: { createdAt: 'asc' },
                select: { key: true },
            });
            for (const object of objects) await this.remove(object.key);
        } catch {
            this.logger.error('Account avatar cleanup sweep failed; will retry.');
        } finally {
            this.isRunning = false;
        }
    }
}
