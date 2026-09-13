import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:41730";

export default defineConfig({
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.001,
    },
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: "test-results/ui-artifacts",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [
    [process.env.CI ? "line" : "list"],
    ["html", { open: "never", outputFolder: "test-results/ui-report" }],
  ],
  retries: process.env.CI ? 1 : 0,
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  testDir: "tests/ui-preview",
  timeout: 60_000,
  use: {
    baseURL,
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm build:packages && pnpm --filter @pickflick/web build && cp -R apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static && HOSTNAME=127.0.0.1 PORT=41730 node apps/web/.next/standalone/apps/web/server.js",
    reuseExistingServer: false,
    timeout: 180_000,
    url: `${baseURL}/ui-preview`,
  },
  workers: 1,
});
