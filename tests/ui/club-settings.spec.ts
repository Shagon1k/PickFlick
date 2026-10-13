import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports, screenshotViewports } from './viewports';
const clubId = '10000000-0000-4000-8000-000000000031';
const route = `/clubs/${clubId}/settings`;
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
    viewport: {
        height: number;
        width: number;
    } = canonicalViewports[0],
) {
    await page.setViewportSize(viewport);
    await page.goto(route, { waitUntil: 'load' });
    await settle(page);
}

for (const viewport of screenshotViewports) {
    test(
        `Club Admin settings match the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-settings-admin-${viewport.name}`);
            await open(page, viewport);
            await expect(page).toHaveScreenshot(`club-settings-admin-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );
}
for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
    test(
        `Club Member settings match the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-settings-member-${viewport.name}`);
            await open(page, viewport);
            await expect(page).toHaveScreenshot(`club-settings-member-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );

    test(
        `Archived Club settings match the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-settings-archived-${viewport.name}`);
            await open(page, viewport);
            await expect(page.getByRole('button', { name: 'Reactivate Club' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Recent invitations' })).toHaveCount(0);
            await page.getByRole('button', { name: 'Delete Club' }).click();
            await expect(
                page
                    .getByRole('dialog', { name: 'Delete this Club?' })
                    .getByRole('textbox', { name: 'Type Midnight Society to confirm' }),
            ).toBeVisible();
            await page.getByRole('button', { name: 'Cancel' }).click();
            await expect(page).toHaveScreenshot(`club-settings-archived-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );
}
