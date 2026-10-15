import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports } from './viewports';

const PATH = '/sessions/30000000-0000-4000-8000-000000000045';
async function authenticate(context: BrowserContext, scenario: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `valid-selection-${scenario}-${crypto.randomUUID()}`,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

test(
    'operator confirms early closure with keyboard and receives the saved result',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'operator');
        await page.goto(PATH);
        const trigger = page.getByRole('button', { name: 'Close Selection early', exact: true });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: 'Close Selection early' });
        await expect(dialog.getByRole('button', { name: 'Confirm close' })).toBeDisabled();
        await expect(
            dialog.getByText('1 of 3 accepted participants', { exact: false }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await trigger.click();
        await page.getByLabel('Type CLOSE to confirm').fill('CLOSE');
        await page.getByLabel('Type CLOSE to confirm').press('Enter');
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Tonight’s pick' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Noir night' })).toBeFocused();
        await expect(page.getByRole('list', { name: 'Selection ranking' })).toBeVisible();
        await expect(page.getByText('No ballots were received.', { exact: false })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Tonight’s pick' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Close Selection early' })).toHaveCount(0);
    },
);

test('early-close dialog keeps confirmation and reports API and offline failures', async ({
    context,
    page,
}) => {
    await authenticate(context, 'operator-failure');
    await page.goto(PATH);
    await page.getByRole('button', { name: 'Close Selection early', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await page.getByLabel('Type CLOSE to confirm').fill('CLOSE');
    await dialog.getByRole('button', { name: 'Confirm close' }).click();
    await expect(dialog.getByText('We could not close Selection. Try again.')).toBeVisible();
    await expect(page.getByLabel('Type CLOSE to confirm')).toHaveValue('CLOSE');
    await context.setOffline(true);
    await dialog.getByRole('button', { name: 'Confirm close' }).click();
    await expect(dialog.getByText('You appear to be offline.', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Type CLOSE to confirm')).toHaveValue('CLOSE');
});

for (const viewport of canonicalViewports) {
    for (const visibility of ['visible', 'hidden-anonymous']) {
        test(`Selection ${visibility} result accessibility and layout at ${viewport.name}`, async ({
            context,
            page,
        }) => {
            await authenticate(context, `outcome-${visibility}`);
            await page.setViewportSize(viewport);
            await page.goto(PATH, { waitUntil: 'load' });
            await settle(page);
            await expect(page.getByRole('heading', { name: 'Tonight’s pick' })).toBeVisible();
            await expect(page.getByRole('list', { name: 'Selection ranking' })).toHaveCount(
                visibility === 'visible' ? 1 : 0,
            );
            await expect(
                page.getByText('Vote breakdowns are hidden', { exact: false }),
            ).toHaveCount(visibility === 'visible' ? 0 : 1);
            await expect(page.getByText('Nominated by', { exact: false })).toHaveCount(
                visibility === 'visible' ? 3 : 0,
            );
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= window.innerWidth,
                ),
            ).toBe(true);
            await page.screenshot({
                path: test.info().outputPath('selection-result.png'),
                fullPage: true,
            });
        });
    }

    test(`Selection confirmation accessibility and focus at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await authenticate(context, 'operator');
        await page.setViewportSize(viewport);
        await page.goto(PATH, { waitUntil: 'load' });
        await settle(page);
        const trigger = page.getByRole('button', { name: 'Close Selection early', exact: true });
        const bounds = await trigger.boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
        await trigger.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.keyboard.press('Tab');
        await expect(page.getByRole('dialog').locator(':focus')).toHaveCount(1);
        await page.screenshot({
            path: test.info().outputPath('selection-confirmation.png'),
            fullPage: true,
        });
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
    });
}
