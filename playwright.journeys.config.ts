import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:41740';

/** Browser journeys through the real web app, API, and an isolated `pickflick_test` database. */
export default defineConfig({
    expect: { timeout: 10_000 },
    forbidOnly: Boolean(process.env.CI),
    outputDir: 'test-results/journey-artifacts',
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    reporter: [
        [process.env.CI ? 'line' : 'list'],
        ['html', { open: 'never', outputFolder: 'test-results/journey-report' }],
    ],
    testDir: 'tests/journeys',
    timeout: 120_000,
    use: {
        baseURL: BASE_URL,
        timezoneId: 'UTC',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        // The web build bakes its API rewrite target, so the journeys build their own copy.
        command:
            'pnpm build:packages && pnpm --filter @pickflick/backend build && BACKEND_INTERNAL_URL=http://127.0.0.1:42741 pnpm --filter @pickflick/frontend build && cp -R apps/frontend/.next/static apps/frontend/.next/standalone/apps/frontend/.next/static && node tests/journeys/start-journey-stack.ts',
        reuseExistingServer: false,
        timeout: 240_000,
        url: BASE_URL,
    },
    workers: 1,
});
