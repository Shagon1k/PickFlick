import type { createDatabaseClient } from "@pickflick/database";

type IdentityLockTransaction = Pick<ReturnType<typeof createDatabaseClient>, "$executeRaw">;

export function identityUserLockKey(userId: string): string {
  return `identity-user:${userId}`;
}

export async function lockIdentityUser(
  transaction: IdentityLockTransaction,
  userId: string,
): Promise<void> {
  const key = identityUserLockKey(userId);
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
