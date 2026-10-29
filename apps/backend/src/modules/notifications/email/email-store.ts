import { createHash, randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient } from '@pickflick/database';

/** Suppression must match however Resend or our records wrote the address, so both sides hash alike. */
export function hashEmailAddress(address: string) {
    return createHash('sha256').update(address.trim().toLowerCase()).digest('hex');
}

export const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 6;
const LEASE_MS = 2 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000] as const;
// The claim UPDATE fills these nullable storage fields before RETURNING.
export type TEmailClaim = Omit<
    Prisma.NotificationEmailDeliveryGetPayload<object>,
    'firstAttemptAt' | 'claimToken'
> & {
    firstAttemptAt: Date;
    claimToken: string;
};

export function getRetryAt(claim: TEmailClaim, now: Date) {
    const delay = RETRY_DELAYS_MS[claim.attemptCount - 1];
    if (delay === undefined) return null;
    const next = new Date(now.getTime() + delay);
    return next.getTime() < claim.firstAttemptAt.getTime() + RETRY_WINDOW_MS ? next : null;
}

export async function claimEmail(prisma: PrismaClient, now: Date) {
    return prisma.$transaction(async (tx) => {
        // Old API instances can still commit email intent during a rolling migration.
        await tx.$executeRaw`INSERT INTO "NotificationEmailDelivery" ("notificationId", "nextAttemptAt")
            SELECT "notificationId", ${now} FROM "NotificationDeliveryAttempt"
            WHERE "channel" = 'EMAIL' AND "status" = 'PENDING' AND "attempt" = 1
            ON CONFLICT ("notificationId") DO NOTHING`;
        const token = randomUUID();
        const leaseUntil = new Date(now.getTime() + LEASE_MS);
        const [claim] = await tx.$queryRaw<TEmailClaim[]>`
            WITH due AS (
                SELECT "notificationId" FROM "NotificationEmailDelivery"
                WHERE ("status" = 'PENDING' AND "nextAttemptAt" <= ${now})
                   OR ("status" = 'PROCESSING' AND "leaseUntil" <= ${now})
                ORDER BY "nextAttemptAt", "notificationId"
                FOR UPDATE SKIP LOCKED LIMIT 1
            )
            UPDATE "NotificationEmailDelivery" AS delivery
            SET "status" = 'PROCESSING', "claimToken" = ${token}::uuid,
                "leaseUntil" = ${leaseUntil}, "attemptCount" = "attemptCount" + 1,
                "firstAttemptAt" = COALESCE("firstAttemptAt", ${now})
            FROM due WHERE delivery."notificationId" = due."notificationId"
            RETURNING delivery.*`;
        if (!claim) return null;
        await tx.notificationDeliveryAttempt.updateMany({
            where: {
                notificationId: claim.notificationId,
                channel: 'EMAIL',
                status: 'PENDING',
                attempt: { lt: claim.attemptCount },
            },
            data: { status: 'FAILED', completedAt: now },
        });
        await tx.notificationDeliveryAttempt.upsert({
            where: {
                notificationId_channel_attempt: {
                    notificationId: claim.notificationId,
                    channel: 'EMAIL',
                    attempt: claim.attemptCount,
                },
            },
            create: {
                notificationId: claim.notificationId,
                channel: 'EMAIL',
                attempt: claim.attemptCount,
                status: 'PENDING',
            },
            update: {},
        });
        return claim;
    });
}

interface IEmailResult {
    claim: TEmailClaim;
    status: 'PENDING' | 'ACCEPTED' | 'FAILED' | 'SUPPRESSED';
    now: Date;
    reason: string | null;
    providerId?: string;
    nextAttemptAt?: Date;
}

export async function finishEmail(prisma: PrismaClient, result: IEmailResult) {
    return prisma.$transaction(async (tx) => {
        const updated = await tx.notificationEmailDelivery.updateMany({
            where: {
                notificationId: result.claim.notificationId,
                claimToken: result.claim.claimToken,
                status: 'PROCESSING',
            },
            data: {
                status: result.status,
                reason: result.reason,
                providerId: result.providerId,
                nextAttemptAt: result.nextAttemptAt,
                leaseUntil: null,
                claimToken: null,
            },
        });
        if (!updated.count) return false;
        await tx.notificationDeliveryAttempt.update({
            where: {
                notificationId_channel_attempt: {
                    notificationId: result.claim.notificationId,
                    channel: 'EMAIL',
                    attempt: result.claim.attemptCount,
                },
            },
            data: {
                status: result.status === 'PENDING' ? 'FAILED' : result.status,
                completedAt: result.now,
            },
        });
        return true;
    });
}
