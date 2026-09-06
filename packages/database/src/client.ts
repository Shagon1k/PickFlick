import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

import { PrismaClient } from "./generated/prisma/client.js";

export function createDatabaseClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export async function checkDatabaseReadiness(
  databaseUrl: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: timeoutMilliseconds,
    query_timeout: timeoutMilliseconds,
    statement_timeout: timeoutMilliseconds,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");
  } finally {
    await client.end();
  }
}
