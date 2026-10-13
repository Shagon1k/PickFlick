import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { screenshotViewports } from './viewports';
const firstClubId = '10000000-0000-4000-8000-000000000031';
async function authenticate(context: BrowserContext, token: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: token,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}
for (const viewport of screenshotViewports) {
    test(
        `Club Hub matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-hub-visual-${viewport.name}`);
            await page.setViewportSize(viewport);
            await page.goto(`/clubs/${firstClubId}`, { waitUntil: 'load' });
            await settle(page);
            await expect(page).toHaveScreenshot(`club-hub-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );
}
