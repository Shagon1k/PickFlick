import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { screenshotViewports } from './viewports';
const clubId = '10000000-0000-4000-8000-000000000031';
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
    for (const state of ['admin', 'member', 'adminless', 'over-limit']) {
        test(
            `Club members ${state} matches ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await authenticate(context, `valid-members-${state}-visual-${viewport.name}`);
                await page.setViewportSize(viewport);
                await page.goto(`/clubs/${clubId}/members`, { waitUntil: 'load' });
                await settle(page);
                await expect(page).toHaveScreenshot(`club-members-${state}-${viewport.name}.png`, {
                    fullPage: true,
                });
            },
        );
    }

    test(
        `pending invite popover matches ${viewport.name}`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-hub-pending-visual-${viewport.name}`);
            await page.setViewportSize(viewport);
            await page.goto(`/clubs/${clubId}`, { waitUntil: 'load' });
            await settle(page);
            await page.getByRole('button', { name: 'Open pending invites' }).click();
            await expect(
                page
                    .getByRole('dialog', { name: 'Pending invites' })
                    .getByRole('button', { name: 'Accept', exact: true }),
            ).toBeVisible();
            await expect(page).toHaveScreenshot(`pending-invites-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );
}
