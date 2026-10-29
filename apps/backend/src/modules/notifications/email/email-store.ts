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

/** Claims one due delivery; `SKIP LOCKED` lets parallel workers take different rows. */
export async function claimEmail(prisma: PrismaClient, now: Date): Promise<TEmailClaim | null> {
    const token = randomUUID();
    const leaseUntil = new Date(now.getTime() + LEASE_MS);
    const [claim] = await prisma.$queryRaw<TEmailClaim[]>`
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
    return claim ?? null;
}

export interface IEmailResult {
    claim: TEmailClaim;
    status: 'PENDING' | 'ACCEPTED' | 'FAILED' | 'SUPPRESSED';
    reason: string | null;
    providerId?: string;
    nextAttemptAt?: Date;
}

export async function finishEmail(prisma: PrismaClient, result: IEmailResult) {
    // The claim token fences a worker whose lease expired: only the current claim may finish it.
    const updated = await prisma.notificationEmailDelivery.updateMany({
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
    return updated.count > 0;
}
