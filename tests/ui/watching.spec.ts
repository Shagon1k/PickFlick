import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { acceptedParticipants } from './session-facts';
import { settle } from './settle';
import { canonicalViewports } from './viewports';

const ROUTE = '/sessions/30000000-0000-4000-8000-000000000049';
async function authenticate(context: BrowserContext, scenario: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `valid-watching-${scenario}-${crypto.randomUUID()}`,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

for (const viewport of canonicalViewports) {
    test(
        `Watching opens Rating with keyboard confirmation at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await authenticate(context, viewport.name);
            await page.setViewportSize(viewport);
            await page.goto(ROUTE, { waitUntil: 'load' });
            await settle(page);
            await expect(page.getByText('watching', { exact: true })).toBeVisible();
            await expect(acceptedParticipants(page)).toHaveText('Jordan Member');
            await expect(page.getByText('Room A', { exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Leave Session' })).toBeVisible();
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({
                path: `test-results/watching-${viewport.name}.png`,
                fullPage: true,
            });
            const settings = page.getByRole('button', { name: 'Session settings' });
            await settings.focus();
            await page.keyboard.press('Enter');
            await expect(page.getByRole('menuitem', { name: 'Open Rating' })).toBeFocused();
            await page.keyboard.press('Enter');
            const dialog = page.getByRole('dialog', { name: 'Open Rating' });
            await expect(dialog).toBeVisible();
            await expect(
                dialog.getByRole('button', { name: 'Open Rating', exact: true }),
            ).toBeDisabled();
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({
                path: `test-results/open-rating-${viewport.name}.png`,
            });
            await page.keyboard.press('Escape');
            await expect(dialog).toHaveCount(0);
            await expect(settings).toBeFocused();
            await expect(page.getByText('watching', { exact: true })).toBeVisible();
            await settings.click();
            await expect(page.getByRole('menuitem', { name: 'Open Rating' })).toBeFocused();
            await settle(page);
            await page.getByRole('menuitem', { name: 'Open Rating' }).click();
            await dialog.getByLabel('Type OPEN to confirm').fill('OPEN');
            await dialog.getByLabel('Type OPEN to confirm').press('Enter');
            await expect(dialog).toHaveCount(0);
            await expect(page.getByText('rating', { exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
            await page.reload();
            await expect(page.getByText('rating', { exact: true })).toBeVisible();
        },
    );
}

for (const scenario of ['member', 'readonly']) {
    test(`Watching preserves participation and hides operator controls for ${scenario}`, async ({
        context,
        page,
    }) => {
        await authenticate(context, scenario);
        await page.goto(ROUTE);
        await expect(page.getByText('watching', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Leave Session' })).toBeVisible();
        await page.reload();
        await expect(page.getByText('watching', { exact: true })).toBeVisible();
    });
}

for (const [scenario, message] of [
    ['failure', 'We could not open Rating. Try again.'],
    ['stale', 'This Session changed. Refresh before opening Rating.'],
]) {
    test(`Opening Rating keeps the dialog on ${scenario} and explains offline recovery`, async ({
        context,
        page,
    }) => {
        await authenticate(context, scenario!);
        await page.goto(ROUTE);
        await page.getByRole('button', { name: 'Session settings' }).click();
        await expect(page.getByRole('menuitem', { name: 'Open Rating' })).toBeFocused();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Open Rating' });
        await dialog.getByLabel('Type OPEN to confirm').fill('OPEN');
        await dialog.getByRole('button', { name: 'Open Rating', exact: true }).click();
        await expect(dialog.getByRole('status')).toHaveText(message!);
        await expect(dialog.getByLabel('Type OPEN to confirm')).toHaveValue('OPEN');
        await context.setOffline(true);
        await dialog.getByRole('button', { name: 'Open Rating', exact: true }).click();
        await expect(dialog.getByRole('status')).toContainText('You appear to be offline.');
    });
}
