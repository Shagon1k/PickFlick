import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import type { IDependencyStatus, ILivenessReport, IReadinessReport } from '@pickflick/contracts';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

const PROBE_TIMEOUT_MS = 2_000;

async function probe(
    name: IDependencyStatus['name'],
    check: () => Promise<unknown>,
): Promise<IDependencyStatus> {
    try {
        await Promise.race([
            check(),
            new Promise((_resolve, reject) =>
                setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS).unref(),
            ),
        ]);
        return { name, status: 'up' };
    } catch {
        return { name, status: 'down' };
    }
}

@Injectable()
export class HealthService {
    constructor(
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    checkLiveness(): ILivenessReport {
        const { sourceRevision } = this.environment;
        return { status: 'alive', ...(sourceRevision ? { revision: sourceRevision } : {}) };
    }

    /** Ready when the database and object storage both answer within two seconds. */
    async checkReadiness(): Promise<IReadinessReport> {
        const checks = await Promise.all([
            probe('database', () => this.prisma.$queryRaw`SELECT 1`),
            probe('objectStorage', () => this.storage.ping()),
        ]);
        return {
            status: checks.every(({ status }) => status === 'up') ? 'ready' : 'not_ready',
            checks,
        };
    }
}
