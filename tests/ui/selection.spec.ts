import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports } from './viewports';

const PATH = '/sessions/30000000-0000-4000-8000-000000000045';
async function authenticate(context: BrowserContext, scenario = '') {
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
    'complete ballot supports keyboard selection, validates missing scores and locks after submission',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'anonymous');
        await page.goto(PATH);
        const groups = page.getByRole('radiogroup');
        await expect(groups).toHaveCount(2);
        await expect(page.getByText('Nominated by Jordan Member')).toHaveCount(0);
        await page.getByRole('button', { name: 'Submit scores' }).click();
        await expect(page.getByText('Choose a score for every nomination.')).toBeVisible();
        await expect(groups.first().getByRole('radio', { name: '0 of 3' })).toBeFocused();
        await page.keyboard.press('End');
        await expect(groups.first().getByRole('radio', { name: '3 of 3' })).toBeChecked();
        await groups.nth(1).getByRole('radio', { name: '0 of 3' }).focus();
        await page.keyboard.press('Home');
        await expect(groups.nth(1).getByRole('radio', { name: '0 of 3' })).toBeChecked();
        await expect(page.getByText('2 of 2 films scored · Ready to submit')).toBeVisible();
        await page.getByRole('button', { name: 'Submit scores' }).click();
        await expect(page.getByText('Your ballot is saved. Your scores are locked.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Movie Selection' })).toBeFocused();
        await expect(page.getByRole('radio')).toHaveCount(0);
        await expect(
            page.getByText('2 of 3 participants have submitted.', { exact: false }),
        ).toBeVisible();
        await page.reload();
        await expect(page.getByText('Your ballot is saved. Your scores are locked.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Submit scores' })).toHaveCount(0);
    },
);

test('recoverable failure and offline submission preserve scores', async ({ context, page }) => {
    await authenticate(context, 'failure');
    await page.goto(PATH);
    for (const group of await page.getByRole('radiogroup').all())
        await group.getByRole('radio', { name: '2 of 3' }).click();
    await page.getByRole('button', { name: 'Submit scores' }).click();
    await expect(
        page.getByText('We could not save your ballot. Your scores are still here; try again.'),
    ).toBeVisible();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(2);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Submit scores' }).click();
    await expect(
        page.getByText(
            'You appear to be offline. Reconnect, then try again; nothing you entered is lost.',
        ),
    ).toBeVisible();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(2);
});

test('legacy scale supports touch and omits zero', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 390, height: 844 },
    });
    try {
        await authenticate(context, 'legacy-maximum');
        const page = await context.newPage();
        await page.goto(PATH);
        await expect(page.getByRole('radio', { name: '0 of 10', exact: true })).toHaveCount(0);
        for (const group of await page.getByRole('radiogroup').all())
            await group.getByRole('radio', { name: '10 of 10' }).tap();
        await page.getByRole('button', { name: 'Submit scores' }).tap();
        await expect(page.getByText('Your ballot is saved. Your scores are locked.')).toBeVisible();
    } finally {
        await context.close();
    }
});

for (const scenario of ['readonly', 'empty']) {
    test(`Selection ${scenario} state prevents submission`, async ({ context, page }) => {
        await authenticate(context, scenario);
        await page.goto(PATH);
        await expect(page.getByRole('button', { name: 'Submit scores' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Refresh Selection' })).toBeVisible();
    });
}

for (const viewport of canonicalViewports) {
    test(`Selection maximum scale accessibility and layout at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await authenticate(context, 'maximum');
        await page.setViewportSize(viewport);
        await page.goto(PATH, { waitUntil: 'load' });
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        const progressBounds = await page
            .getByRole('progressbar', { name: 'Selection progress' })
            .boundingBox();
        expect(progressBounds?.width).toBeGreaterThanOrEqual(44);
        const target = page.getByRole('radio', { name: '10 of 10' }).first();
        const bounds = await target.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: test.info().outputPath('selection.png'), fullPage: true });
    });
}
