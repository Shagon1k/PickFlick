import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@/': source('./apps/frontend/src/'),
            '@brand/': source('./assets/brand/'),
            '@pickflick/contracts': source('./packages/contracts/src/index.ts'),
            '@pickflick/database': source('./packages/database/src/index.ts'),
            // Next swaps `server-only` for an empty module on the server; tests run on the server too.
            'server-only': source('./apps/frontend/node_modules/server-only/empty.js'),
        },
    },
    test: {
        globals: true,
        include: [
            'apps/**/*.{test,spec}.{ts,tsx}',
            'packages/**/*.{test,spec}.{ts,tsx}',
            'scripts/**/*.{test,spec}.{ts,tsx}',
        ],
        exclude: ['**/node_modules/**', '**/dist/**', '**/*.int.spec.ts'],
    },
});
