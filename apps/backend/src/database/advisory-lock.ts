import type { Prisma } from '@pickflick/database';

/** Serialises transactions that check and then change the same limit, such as Clubs per Admin. */
export async function lockKey(transaction: Prisma.TransactionClient, key: string): Promise<void> {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
