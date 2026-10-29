import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';
import { canonicalViewports } from './viewports';

const ROUTE = '/sessions/30000000-0000-4000-8000-000000000050';
async function authenticate(context: BrowserContext, scenario: string) {
    await signInMock(context, `valid-rating-${scenario}-${crypto.randomUUID()}`);
}

for (const viewport of canonicalViewports) {
    test(
        `Rating saves an immutable response and completes partially at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await authenticate(context, viewport.name);
            await page.setViewportSize(viewport);
            await page.goto(ROUTE, { waitUntil: 'load' });
            await settle(page);
            await expect(page.getByText(/Rating in progress — 1 of 3/)).toBeVisible();
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            const first = page.getByRole('radio', { name: '1 of 10', exact: true });
            expect(
                await first.evaluate((element) => element.getBoundingClientRect().width),
            ).toBeGreaterThanOrEqual(44);
            await page.getByRole('button', { name: 'Submit Rating' }).click();
            await expect(first).toBeFocused();
            await page.keyboard.press('End');
            await page.keyboard.press('ArrowLeft');
            await expect(page.getByRole('radio', { name: '9 of 10' })).toHaveAttribute(
                'aria-checked',
                'true',
            );
            await page.getByLabel('Comment', { exact: false }).fill('A lasting impression.');
            await page.screenshot({
                path: `test-results/rating-${viewport.name}.png`,
                fullPage: true,
            });
            await page.getByRole('button', { name: 'Submit Rating' }).click();
            await expect(page.getByText('Your rating is saved')).toBeVisible();
            await expect(page.getByText(/Rating in progress — 2 of 3/)).toBeVisible();
            await expect(page.getByRole('button', { name: 'Submit Rating' })).toHaveCount(0);
            await page.reload();
            await expect(page.getByText('A lasting impression.', { exact: true })).toBeVisible();
            await expect(page.getByText('A memorable screening.')).toHaveCount(0);
            const settings = page.getByRole('button', { name: 'Session settings' });
            await settings.focus();
            await page.keyboard.press('Enter');
            await expect(page.getByRole('menuitem', { name: 'Close Rating early' })).toBeFocused();
            await page.keyboard.press('Enter');
            const dialog = page.getByRole('dialog', { name: 'Close Rating early' });
            await expect(dialog).toHaveCSS('opacity', '1');
            await expect(dialog.getByText(/2 received ratings/)).toBeVisible();
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.keyboard.press('Escape');
            await expect(dialog).toHaveCount(0);
            await expect(settings).toBeFocused();
            await settings.click();
            await expect(page.getByRole('menuitem', { name: 'Close Rating early' })).toBeFocused();
            await page.keyboard.press('Enter');
            await dialog.getByLabel('Type CLOSE to confirm').fill('CLOSE');
            await dialog.getByRole('button', { name: 'Complete Session' }).click();
            await expect(dialog).toHaveCount(0);
            await expect(page.getByText('completed', { exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Individual Ratings' })).toBeVisible();
            await expect(page.getByText('A memorable screening.')).toBeVisible();
            await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await settle(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({
                path: `test-results/rating-completed-${viewport.name}.png`,
                fullPage: true,
            });
        },
    );
}

for (const scenario of ['member', 'readonly', 'hidden-completed']) {
    test(`Rating enforces ${scenario} controls and visibility`, async ({ context, page }) => {
        await authenticate(context, scenario);
        await page.goto(ROUTE);
        await expect(page.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Submit Rating' })).toHaveCount(
            scenario === 'member' ? 1 : 0,
        );
        await expect(page.getByText('A memorable screening.')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Individual Ratings' })).toHaveCount(0);
    });
}

test('Rating keeps input and explains save failure and offline recovery', async ({
    context,
    page,
}) => {
    await authenticate(context, 'failure');
    await page.goto(ROUTE);
    await page.getByRole('radio', { name: '7 of 10' }).click();
    await page.getByLabel('Comment').fill('Keep my comment.');
    await page.getByRole('button', { name: 'Submit Rating' }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'We could not save your rating.' }),
    ).toBeVisible();
    await expect(page.getByLabel('Comment')).toHaveValue('Keep my comment.');
    await expect(page.getByRole('radio', { name: '7 of 10' })).toHaveAttribute(
        'aria-checked',
        'true',
    );
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Submit Rating' }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'You appear to be offline.' }),
    ).toBeVisible();
});

for (const [scenario, message] of [
    ['stale', 'This Session changed. Refresh before closing Rating.'],
    ['closefailure', 'We could not close Rating. Try again.'],
]) {
    test(`Rating closure preserves confirmation on ${scenario}`, async ({ context, page }) => {
        await authenticate(context, scenario!);
        await page.goto(ROUTE);
        await page.getByRole('button', { name: 'Session settings' }).click();
        await expect(page.getByRole('menuitem', { name: 'Close Rating early' })).toBeFocused();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Close Rating early' });
        await dialog.getByLabel('Type CLOSE to confirm').fill('CLOSE');
        await dialog.getByRole('button', { name: 'Complete Session' }).click();
        await expect(dialog.getByRole('status')).toHaveText(message!);
        await expect(dialog.getByLabel('Type CLOSE to confirm')).toHaveValue('CLOSE');
    });
}

test('Rating supports touch and reduced motion on a phone', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
    });
    try {
        await authenticate(context, 'touch');
        const page = await context.newPage();
        await page.goto(ROUTE);
        await page.getByRole('radio', { name: '7 of 10' }).tap();
        await page.getByRole('button', { name: 'Submit Rating' }).tap();
        await expect(page.getByText('Your rating is saved')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    } finally {
        await context.close();
    }
});

test('Completed Rating explains an empty result without inventing responses', async ({
    context,
    page,
}) => {
    await authenticate(context, 'empty-completed');
    await page.goto(ROUTE);
    await expect(page.getByText('No ratings were received.')).toBeVisible();
    await expect(
        page.getByText('This Session is complete. No more ratings can be added.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Rating' })).toHaveCount(0);
});
