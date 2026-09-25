import type { createDatabaseClient } from '@pickflick/database';

type LockingTransaction = Pick<ReturnType<typeof createDatabaseClient>, '$executeRaw'>;

/**
 * Takes transaction-scoped Postgres advisory locks in the order given. Callers acquire shared keys
 * in one global order (operation, then creator, then Club) so concurrent transactions cannot deadlock.
 */
export async function lockKeys(
    transaction: LockingTransaction,
    ...keys: readonly string[]
): Promise<void> {
    for (const key of keys) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
}
