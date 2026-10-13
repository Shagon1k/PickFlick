import { defineConfig } from '@playwright/test';

import config, { uiWebServer } from './playwright.ui.config';

export default defineConfig({
    ...config,
    grep: /@visual/,
    grepInvert: [],
    webServer: {
        ...uiWebServer,
        command:
            'pnpm build:packages && pnpm --filter @pickflick/frontend build && cp -R apps/frontend/.next/static apps/frontend/.next/standalone/apps/frontend/.next/static && node tests/ui/start-frontend-with-mock-api.mjs',
    },
});
