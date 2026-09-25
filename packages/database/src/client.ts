import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';

import { PrismaClient } from './generated/prisma/client.js';

export function createDatabaseAdapter(databaseUrl: string): PrismaPg {
    return new PrismaPg({ connectionString: databaseUrl });
}

export function createDatabaseClient(databaseUrl: string): PrismaClient {
    return new PrismaClient({ adapter: createDatabaseAdapter(databaseUrl) });
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
        await client.query('SELECT 1');
    } finally {
        await client.end();
    }
}
