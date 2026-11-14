import { randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient } from '@pickflick/database';

export const EXPORT_AVAILABILITY_MS = 7 * 24 * 60 * 60_000;
export const MAX_EXPORT_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;
const ABANDONED_OBJECT_MS = 60 * 60_000;
export type TExportClaim = Prisma.DataExportJobGetPayload<object> & { claimToken: string };

/** Every attempt has a tracked immutable key, so a reclaimed worker cannot overwrite a winner. */
export async function claimExport(prisma: PrismaClient, now: Date): Promise<TExportClaim | null> {
    return prisma.$transaction(async (tx) => {
        const token = randomUUID();
        const [job] = await tx.$queryRaw<TExportClaim[]>`
            WITH due AS (
                SELECT id FROM "DataExportJob"
                WHERE "attemptCount" < ${MAX_EXPORT_ATTEMPTS} AND (
                    (status = 'PENDING' AND "nextAttemptAt" <= ${now})
                    OR (status = 'PROCESSING' AND "leaseUntil" <= ${now}))
                ORDER BY "nextAttemptAt", id FOR UPDATE SKIP LOCKED LIMIT 1
            )
            UPDATE "DataExportJob" AS job SET status = 'PROCESSING',
                "claimToken" = ${token}::uuid, "leaseUntil" = ${new Date(now.getTime() + LEASE_MS)},
                "attemptCount" = "attemptCount" + 1
            FROM due WHERE job.id = due.id RETURNING job.*`;
        if (!job) return null;
        await tx.dataExportObject.create({
            data: {
                key: getExportObjectKey(job),
                jobId: job.id,
                deleteAfter: new Date(now.getTime() + ABANDONED_OBJECT_MS),
            },
        });
        return job;
    });
}

export function getExportObjectKey(claim: TExportClaim) {
    return `data-exports/${claim.id}/${claim.claimToken}.json.gz`;
}
