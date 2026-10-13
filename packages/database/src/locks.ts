import type { Prisma } from './generated/prisma/client.js';

export async function lockClub(tx: Prisma.TransactionClient, clubId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId}::uuid FOR UPDATE`;
}

/** Take the Club lock first when a workflow needs both. */
export async function lockSession(tx: Prisma.TransactionClient, sessionId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId}::uuid FOR UPDATE`;
}
