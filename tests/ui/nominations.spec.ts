import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports } from './viewports';

const path = '/sessions/30000000-0000-4000-8000-000000000042';
async function authenticate(context: BrowserContext, scenario = '') {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `valid-nomination-${scenario}-${crypto.randomUUID()}`,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

test(
    'Personal suggestion uses the submission flow and locks the confirmed Movie',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'hidden-anonymous');
        await page.goto(path);
        await expect(
            page.getByText('Nominations are hidden until you submit your own Movie.'),
        ).toBeVisible();
        await expect(page.getByText('Current private film')).toHaveCount(0);
        await page.getByRole('button', { name: 'Past losing nomination (2020)' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText('Selected: Past losing nomination (2020)')).toBeVisible();
        await page.getByRole('button', { name: 'Nominate This' }).click();
        await expect(page.getByText('Your nomination is confirmed.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Nominate This' })).toHaveCount(0);
        await expect(page.getByText('2 of 3 participants have nominated.')).toBeVisible();
        await expect(page.getByText('by Jordan Member')).toHaveCount(0);
    },
);

test('Search selection and failure/offline states retain the selected Movie', async ({
    context,
    page,
}) => {
    await authenticate(context, 'failure');
    await page.goto(path);
    const search = page.getByRole('combobox', { name: 'Select a Movie' });
    await search.fill('Dune');
    await expect(page.getByRole('option').first()).toBeVisible();
    await search.press('ArrowDown');
    await search.press('Enter');
    await page.getByRole('button', { name: 'Nominate This' }).click();
    await expect(
        page.getByText('We could not save this action. Your selection is still here; try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove selected Movie' })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Nominate This' }).click();
    await expect(
        page.getByText(
            'You appear to be offline. Reconnect before continuing; your selection is still here.',
        ),
    ).toBeVisible();
});

test('Operator early close traps and returns focus and requires confirmation', async ({
    context,
    page,
}) => {
    await authenticate(context, 'operator');
    await page.goto(path);
    const close = page.getByRole('button', { name: 'Close nominations early' });
    await close.click();
    await expect(page.getByRole('button', { name: 'Confirm close' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(close).toBeFocused();
    await close.click();
    await page.getByLabel('Type CLOSE to confirm').fill('CLOSE');
    await page.getByRole('button', { name: 'Confirm close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('selection', { exact: true })).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Nomination night', exact: true }),
    ).toBeFocused();
});

for (const viewport of canonicalViewports) {
    test(`Nomination accessibility and local carousel at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await authenticate(context);
        await page.setViewportSize(viewport);
        await page.goto(path, { waitUntil: 'load' });
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.screenshot({ path: test.info().outputPath('nomination.png'), fullPage: true });
    });
}
