import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

// Database integration tests share one local database, so files run one at a time.
export default defineConfig({
    resolve: baseConfig.resolve,
    test: {
        globals: true,
        include: ['apps/**/*.int.spec.ts', 'packages/**/*.int.spec.ts'],
        fileParallelism: false,
        testTimeout: 60_000,
    },
});
