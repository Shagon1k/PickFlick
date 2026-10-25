import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { settle } from './settle';

const MOVIE_ID = '10000000-0000-4000-8000-000000000037';

for (const width of [390, 768, 1024, 1440]) {
    test(
        `Personal Rating edits persist with keyboard, touch and accessible layout at ${width}`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width, height: 900 },
                hasTouch: true,
            });
            await context.addCookies([
                {
                    name: 'pickflick.session_token',
                    value: `valid-personal-${width}`,
                    domain: '127.0.0.1',
                    path: '/',
                },
            ]);
            const page = await context.newPage();
            try {
                await page.route('**/api/movies/images/**', (route) => route.abort());
                await page.goto(`/movies/${MOVIE_ID}`, { waitUntil: 'load' });
                const trigger = page.getByRole('button', { name: 'Rate this film' });
                await trigger.focus();
                await page.keyboard.press('Enter');
                const dialog = page.getByRole('dialog', {
                    name: /^(?:Rate this film|Your rating:)/u,
                });
                await expect(dialog).toBeVisible();
                const first = dialog.getByRole('radio', { name: '1 of 10', exact: true });
                await first.focus();
                await page.keyboard.press('End');
                await expect(dialog.getByRole('radio', { name: '10 of 10' })).toBeChecked();
                await expect(dialog.getByText('10/10', { exact: true })).toBeVisible();
                await dialog.getByRole('button', { name: 'Save rating' }).click();
                await expect(dialog.getByText('Personal Rating saved.')).toBeVisible();
                await expect(
                    page.getByRole('button', { name: 'Your rating: 10 out of 10. Edit rating' }),
                ).toBeVisible();
                await page.keyboard.press('Escape');
                await expect(dialog).toHaveCount(0);
                await expect(
                    page.getByRole('button', { name: 'Your rating: 10 out of 10. Edit rating' }),
                ).toBeFocused();
                await page.reload({ waitUntil: 'load' });
                await page
                    .getByRole('button', { name: 'Your rating: 10 out of 10. Edit rating' })
                    .tap();
                const seven = dialog.getByRole('radio', { name: '7 of 10' });
                await seven.scrollIntoViewIfNeeded();
                await seven.tap();
                await expect(seven).toBeChecked();
                await dialog.getByRole('button', { name: 'Save rating' }).tap();
                await expect(dialog.getByText('Personal Rating saved.')).toBeVisible();
                await settle(page);
                const hasRailOverflow = await dialog
                    .getByRole('radiogroup')
                    .evaluate((rail) => rail.scrollWidth > rail.clientWidth);
                expect(hasRailOverflow).toBe(width === 390);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                await page.screenshot({
                    path: `test-results/personal-rating-${width}.png`,
                    fullPage: true,
                });
                await page.keyboard.press('Escape');
                await page.reload();
                await expect(
                    page.getByRole('button', { name: 'Your rating: 7 out of 10. Edit rating' }),
                ).toBeVisible();
            } finally {
                await context.close();
            }
        },
    );
}

test(
    'Personal Rating retains selection offline and after failed saves, then recovers',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await context.addCookies([
            {
                name: 'pickflick.session_token',
                value: 'valid-rating-failure',
                domain: '127.0.0.1',
                path: '/',
            },
        ]);
        await page.route('**/api/movies/images/**', (route) => route.abort());
        await page.goto(`/movies/${MOVIE_ID}`);
        await page.getByRole('button', { name: 'Rate this film' }).click();
        const dialog = page.getByRole('dialog', { name: /^(?:Rate this film|Your rating:)/u });
        await dialog.getByRole('radio', { name: '8 of 10' }).click();
        await context.setOffline(true);
        await dialog.getByRole('button', { name: 'Save rating' }).click();
        await expect(dialog.getByText(/offline/iu)).toBeVisible();
        await expect(dialog.getByRole('radio', { name: '8 of 10' })).toBeChecked();
        await context.setOffline(false);
        await dialog.getByRole('button', { name: 'Save rating' }).click();
        await expect(
            dialog.getByText('We could not save your rating.', { exact: false }),
        ).toBeVisible();
        await expect(dialog.getByRole('radio', { name: '8 of 10' })).toBeChecked();
        await context.addCookies([
            {
                name: 'pickflick.session_token',
                value: 'valid-rating-recovery',
                domain: '127.0.0.1',
                path: '/',
            },
        ]);
        await dialog.getByRole('button', { name: 'Save rating' }).click();
        await expect(dialog.getByText('Personal Rating saved.')).toBeVisible();
    },
);
