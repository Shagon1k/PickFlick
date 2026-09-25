import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

const packageRoot = fileURLToPath(new URL('./', import.meta.url));
const repositoryRoot = resolve(packageRoot, '../..');
const configuredEnvironmentFile = process.env.PICKFLICK_ENV_FILE?.trim();
// resolve() keeps an absolute path as given and anchors a relative one at the repository.
const environmentFile = resolve(repositoryRoot, configuredEnvironmentFile || '.env');

try {
    loadEnvFile(environmentFile);
} catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT' || configuredEnvironmentFile) {
        throw error;
    }
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx src/cli/seed.ts',
    },
    datasource: {
        url: process.env.DATABASE_URL ?? 'postgresql://invalid:invalid@127.0.0.1:1/invalid',
    },
});
