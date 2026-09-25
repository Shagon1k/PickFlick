import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@pickflick/contracts': fileURLToPath(
                new URL('./packages/contracts/src/index.ts', import.meta.url),
            ),
            '@pickflick/observability': fileURLToPath(
                new URL('./packages/observability/src/index.ts', import.meta.url),
            ),
            '@pickflick/database': fileURLToPath(
                new URL('./packages/database/src/index.ts', import.meta.url),
            ),
        },
    },
    test: {
        include: ['apps/**/*.test.ts', 'packages/**/*.test.ts', 'scripts/**/*.test.ts'],
    },
});
