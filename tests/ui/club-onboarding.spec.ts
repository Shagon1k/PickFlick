import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { settle } from './settle';
import { screenshotViewports } from './viewports';
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
async function open(
    page: Page,
    route: string,
    viewport: {
        height: number;
        width: number;
    },
) {
    await page.setViewportSize(viewport);
    await page.goto(route, { waitUntil: 'load' });
    await settle(page);
}
for (const viewport of screenshotViewports) {
    test(
        `no-Clubs matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-no-clubs-${viewport.name}`);
            await open(page, '/app', viewport);
            await expect(page).toHaveScreenshot(`no-clubs-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );

    test(
        `Create Club matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-create-club-${viewport.name}`);
            await open(page, '/clubs/new', viewport);
            await expect(page).toHaveScreenshot(`create-club-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );
}
