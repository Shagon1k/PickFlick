import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import {
    ConflictException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import type {
    TDataExportDownloadQuery,
    TDataExportJob,
    TDataExportLink,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

const LINK_AVAILABILITY_MS = 5 * 60_000;
const SIGNING_KEY_BYTES = 32;
type TStoredJob = Prisma.DataExportJobGetPayload<object>;

@Injectable()
export class DataExportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    async request(userId: string, requestId: string): Promise<TDataExportJob> {
        const job = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
            const user = await tx.user.findUnique({
                where: { id: userId, status: 'ACTIVE' },
                select: { id: true },
            });
            if (!user) throw new NotFoundException();
            const existing = await tx.dataExportJob.findUnique({
                where: { userId_requestId: { userId, requestId } },
            });
            if (existing) return existing;
            const active = await tx.dataExportJob.findFirst({
                where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
                select: { id: true },
            });
            if (active) throw new ConflictException({ reason: 'EXPORT_IN_PROGRESS' });
            return tx.dataExportJob.create({
                data: {
                    userId,
                    requestId,
                    signingKey: randomBytes(SIGNING_KEY_BYTES).toString('hex'),
                },
            });
        });
        return this.toStatus(job);
    }

    async get(userId: string, id: string): Promise<TDataExportJob> {
        return this.toStatus(await this.findOwn(userId, id));
    }

    async createLink(userId: string, id: string): Promise<TDataExportLink> {
        const job = await this.findReady(userId, id);
        const expires = String(
            Math.min(Date.now() + LINK_AVAILABILITY_MS, job.expiresAt.getTime()),
        );
        const signature = this.sign(job, expires);
        return {
            url: `/api/account/data-exports/${id}/download?expires=${expires}&signature=${signature}`,
            expiresAt: new Date(Number(expires)).toISOString(),
        };
    }

    async download(userId: string, id: string, query: TDataExportDownloadQuery) {
        const job = await this.findReady(userId, id);
        const expires = Number(query.expires);
        const expected = Buffer.from(this.sign(job, query.expires), 'hex');
        const supplied = Buffer.from(query.signature, 'hex');
        if (
            expires <= Date.now() ||
            expires > job.expiresAt.getTime() ||
            !timingSafeEqual(expected, supplied)
        )
            throw new NotFoundException();
        const object = await this.storage.get(job.objectKey);
        if (!object) throw new ServiceUnavailableException({ reason: 'EXPORT_OBJECT_UNAVAILABLE' });
        // Storage can be slow; enforce both deadlines and account access again before returning bytes.
        await this.findReady(userId, id);
        if (expires <= Date.now()) throw new NotFoundException();
        return object.body;
    }

    private async findOwn(userId: string, id: string) {
        const job = await this.prisma.dataExportJob.findFirst({
            where: { id, userId, user: { status: 'ACTIVE' } },
        });
        if (!job) throw new NotFoundException();
        return job;
    }

    private async findReady(userId: string, id: string) {
        const job = await this.findOwn(userId, id);
        if (
            job.status !== 'READY' ||
            !job.objectKey ||
            !job.expiresAt ||
            job.expiresAt.getTime() <= Date.now()
        )
            throw new NotFoundException();
        return { ...job, objectKey: job.objectKey, expiresAt: job.expiresAt };
    }

    private sign(job: TStoredJob, expires: string) {
        return createHmac('sha256', Buffer.from(job.signingKey, 'hex'))
            .update(`${job.id}:${job.userId}:${expires}`)
            .digest('hex');
    }

    private toStatus(job: TStoredJob): TDataExportJob {
        return {
            id: job.id,
            status:
                job.status === 'READY' && job.expiresAt && job.expiresAt.getTime() <= Date.now()
                    ? 'EXPIRED'
                    : job.status,
            attemptCount: job.attemptCount,
            createdAt: job.createdAt.toISOString(),
            completedAt: job.completedAt?.toISOString() ?? null,
            expiresAt: job.expiresAt?.toISOString() ?? null,
            nextAttemptAt: job.status === 'PENDING' ? job.nextAttemptAt.toISOString() : null,
            failure:
                job.failure === 'ACCOUNT_UNAVAILABLE' || job.failure === 'GENERATION_FAILED'
                    ? job.failure
                    : null,
        };
    }
}
