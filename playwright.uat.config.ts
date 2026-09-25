import { defineConfig, devices } from '@playwright/test';

// Smokes a deployed environment; the deploy workflow passes its URL.
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) {
    throw new Error('PLAYWRIGHT_BASE_URL is required for the UAT smoke.');
}

export default defineConfig({
    forbidOnly: Boolean(process.env.CI),
    outputDir: 'test-results/uat',
    projects: [
        {
            name: 'desktop',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
        },
        {
            name: 'mobile',
            use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
        },
    ],
    reporter: [[process.env.CI ? 'line' : 'list']],
    retries: process.env.CI ? 1 : 0,
    testDir: 'tests/uat',
    timeout: 60_000,
    use: {
        baseURL,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        screenshot: 'on',
        trace: 'retain-on-failure',
    },
});
