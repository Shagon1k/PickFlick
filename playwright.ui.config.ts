import { defineConfig, devices } from '@playwright/test';

import { testServerPorts } from './tests/ui/server-ports';

const ports =
    process.env.PORT && process.env.BACKEND_PORT
        ? { web: Number(process.env.PORT), backend: Number(process.env.BACKEND_PORT) }
        : await testServerPorts();
// Playwright reloads its configuration in workers; they must reuse the parent's server addresses.
process.env.PORT = String(ports.web);
process.env.BACKEND_PORT = String(ports.backend);
const baseURL = `http://127.0.0.1:${ports.web}`;

export const uiWebServer = {
    env: {
        AUTH_BASE_URL: baseURL,
        PORT: String(ports.web),
        BACKEND_PORT: String(ports.backend),
        BACKEND_INTERNAL_URL: `http://127.0.0.1:${ports.backend}`,
    },
    command:
        'pnpm build:packages && pnpm db:migrate && pnpm --filter @pickflick/backend build && pnpm --filter @pickflick/frontend build && cp -R apps/frontend/.next/static apps/frontend/.next/standalone/apps/frontend/.next/static && node apps/backend/dist/testing/ui-api.js',
    reuseExistingServer: false,
    timeout: 180_000,
    url: `${baseURL}/ui-preview`,
};

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
    grepInvert: /@visual/,
    testDir: 'tests/ui',
    timeout: 60_000,
    use: {
        baseURL,
        colorScheme: 'dark',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
    webServer: uiWebServer,
    workers: 1,
});
