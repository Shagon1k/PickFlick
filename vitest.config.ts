import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@pickflick/contracts': source('./packages/contracts/src/index.ts'),
            '@pickflick/observability': source('./packages/observability/src/index.ts'),
            '@pickflick/database': source('./packages/database/src/index.ts'),
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
