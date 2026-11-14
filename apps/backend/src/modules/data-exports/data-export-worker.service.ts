import {
    Inject,
    Injectable,
    Logger,
    type OnModuleDestroy,
    type OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { buildArchive } from './archive.js';
import {
    claimExport,
    EXPORT_AVAILABILITY_MS,
    getExportObjectKey,
    MAX_EXPORT_ATTEMPTS,
    type TExportClaim,
} from './data-export-store.js';

const SWEEP_INTERVAL_MS = 5000;
const RETRY_DELAY_MS = 60_000;
const STORAGE_TIMEOUT_MS = 30_000;
const CLEANUP_BATCH_SIZE = 20;

@Injectable()
export class DataExportWorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DataExportWorkerService.name);
    private timer?: ReturnType<typeof setInterval>;
    private cycle?: Promise<void>;

    constructor(
        private readonly prisma: PrismaService,
        @Inject(StorageService)
        private readonly storage: Pick<StorageService, 'get' | 'put' | 'delete'>,
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
            this.logger.error({ event: 'export.cycle.failed' });
        });
        try {
            await this.cycle;
        } finally {
            this.cycle = undefined;
        }
    }

    private async runOnce(now: Date) {
        await this.cleanup(now);
        const exhausted = await this.prisma.dataExportJob.updateMany({
            where: {
                status: 'PROCESSING',
                leaseUntil: { lte: now },
                attemptCount: { gte: MAX_EXPORT_ATTEMPTS },
            },
            data: {
                status: 'FAILED',
                failure: 'GENERATION_FAILED',
                claimToken: null,
                leaseUntil: null,
            },
        });
        if (exhausted.count)
            this.logger.error({ event: 'export.claims.exhausted', count: exhausted.count });
        const claim = await claimExport(this.prisma, now);
        if (!claim) return;
        this.logger.log({
            event: 'export.attempt.started',
            jobId: claim.id,
            attempt: claim.attemptCount,
        });
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: claim.userId, status: 'ACTIVE' },
                select: { id: true },
            });
            if (!user) {
                await this.fail(claim, 'ACCOUNT_UNAVAILABLE');
                return;
            }
            const body = await buildArchive(this.prisma, this.storage, claim.userId);
            await this.storage.put(
                getExportObjectKey(claim),
                body,
                'application/gzip',
                AbortSignal.timeout(STORAGE_TIMEOUT_MS),
            );
            await this.finish(claim);
        } catch {
            // Provider/SQL errors may carry data or credentials; only a fixed reason is persisted.
            await this.fail(claim, 'GENERATION_FAILED');
        }
    }

    private async finish(claim: TExportClaim) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + EXPORT_AVAILABILITY_MS);
        const key = getExportObjectKey(claim);
        const isFinished = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.dataExportJob.updateMany({
                where: {
                    id: claim.id,
                    status: 'PROCESSING',
                    claimToken: claim.claimToken,
                    leaseUntil: { gt: now },
                    user: { status: 'ACTIVE' },
                },
                data: {
                    status: 'READY',
                    objectKey: key,
                    completedAt: now,
                    expiresAt,
                    failure: null,
                    claimToken: null,
                    leaseUntil: null,
                },
            });
            if (updated.count)
                await tx.dataExportObject.update({
                    where: { key },
                    data: { deleteAfter: expiresAt },
                });
            return updated.count > 0;
        });
        this.logger.log({
            event: isFinished ? 'export.ready' : 'export.claim.superseded',
            jobId: claim.id,
            attempt: claim.attemptCount,
        });
    }

    private async fail(claim: TExportClaim, failure: 'ACCOUNT_UNAVAILABLE' | 'GENERATION_FAILED') {
        const hasRetry =
            failure === 'GENERATION_FAILED' && claim.attemptCount < MAX_EXPORT_ATTEMPTS;
        const updated = await this.prisma.dataExportJob.updateMany({
            where: { id: claim.id, claimToken: claim.claimToken, status: 'PROCESSING' },
            data: {
                status: hasRetry ? 'PENDING' : 'FAILED',
                failure,
                nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
                claimToken: null,
                leaseUntil: null,
            },
        });
        if (updated.count)
            this.logger.error({
                event: hasRetry ? 'export.retry.scheduled' : 'export.failed',
                jobId: claim.id,
                attempt: claim.attemptCount,
                reason: failure,
            });
    }

    private async cleanup(now: Date) {
        await this.prisma.dataExportJob.updateMany({
            where: {
                status: 'READY',
                OR: [{ expiresAt: { lte: now } }, { user: { status: { not: 'ACTIVE' } } }],
            },
            data: { status: 'EXPIRED' },
        });
        const objects = await this.prisma.dataExportObject.findMany({
            where: { OR: [{ deleteAfter: { lte: now } }, { job: { status: 'EXPIRED' } }] },
            take: CLEANUP_BATCH_SIZE,
            orderBy: { deleteAfter: 'asc' },
        });
        for (const object of objects) {
            try {
                await this.storage.delete(object.key);
                await this.prisma.dataExportObject.deleteMany({ where: { key: object.key } });
                this.logger.log({ event: 'export.object.deleted', jobId: object.jobId });
            } catch {
                this.logger.error({ event: 'export.cleanup.failed', jobId: object.jobId });
            }
        }
    }
}
