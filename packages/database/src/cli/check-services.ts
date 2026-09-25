import { loadRuntimeEnvironment } from '@pickflick/config/environment';

import { createDatabaseClient } from '../client.js';

// Local development check: PostgreSQL answers a query and MinIO reports itself live.
const environment = loadRuntimeEnvironment();
const database = createDatabaseClient(environment.databaseUrl);

try {
    await database.$queryRaw`SELECT 1`;
} finally {
    await database.$disconnect();
}

const storage = await fetch(new URL('/minio/health/live', environment.storage.endpoint), {
    signal: AbortSignal.timeout(3_000),
});
if (!storage.ok) {
    throw new Error(`Object storage health check returned HTTP ${storage.status}.`);
}

console.log('Local services reachable: PostgreSQL and S3-compatible storage.');
