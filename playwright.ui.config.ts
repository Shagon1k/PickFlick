import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:41730';

export default defineConfig({
    expect: {
        timeout: 10_000,
        toHaveScreenshot: {
            animations: 'disabled',
            maxDiffPixels: 0,
        },
    },
    failOnFlakyTests: Boolean(process.env.CI),
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: true,
    outputDir: 'test-results/ui-artifacts',
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    reporter: [
        [process.env.CI ? 'line' : 'list'],
        ['html', { open: 'never', outputFolder: 'test-results/ui-report' }],
    ],
    retries: process.env.CI ? 1 : 0,
    snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
    testDir: 'tests/ui-preview',
    timeout: 60_000,
    use: {
        baseURL,
        colorScheme: 'dark',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command:
            'pnpm build:packages && BACKEND_INTERNAL_URL=http://127.0.0.1:42731 pnpm --filter @pickflick/frontend build && cp -R apps/frontend/.next/static apps/frontend/.next/standalone/apps/frontend/.next/static && node tests/ui-preview/start-frontend-with-mock-api.mjs',
        reuseExistingServer: false,
        timeout: 180_000,
        url: `${baseURL}/ui-preview`,
    },
    workers: 1,
});
