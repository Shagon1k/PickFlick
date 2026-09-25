import type { createDatabaseClient } from "@pickflick/database";

import { lockKeys } from "../database/advisory-lock.js";

type IdentityLockTransaction = Pick<ReturnType<typeof createDatabaseClient>, "$executeRaw">;

export function identityUserLockKey(userId: string): string {
  return `identity-user:${userId}`;
}

export async function lockIdentityUser(
  transaction: IdentityLockTransaction,
  userId: string,
): Promise<void> {
  await lockKeys(transaction, identityUserLockKey(userId));
}
