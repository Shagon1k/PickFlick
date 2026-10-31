import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
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
            await signInMock(context, `valid-personal-${width}`);
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
                // Choosing a star saves it; there is no separate Save button.
                await expect(dialog.getByText('Personal Rating saved.')).toBeAttached();
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
                await expect(dialog.getByText('Personal Rating saved.')).toBeAttached();
                await settle(page);
                // All ten stars fit the popover at every width, so nothing scrolls sideways.
                const hasOverflow = await dialog.evaluate(
                    (popover) => popover.scrollWidth > popover.clientWidth,
                );
                expect(hasOverflow).toBe(false);
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
        await signInMock(context, 'valid-rating-failure');
        await page.route('**/api/movies/images/**', (route) => route.abort());
        await page.goto(`/movies/${MOVIE_ID}`);
        await page.getByRole('button', { name: 'Rate this film' }).click();
        const dialog = page.getByRole('dialog', { name: /^(?:Rate this film|Your rating:)/u });
        const eight = dialog.getByRole('radio', { name: '8 of 10' });
        // A chosen star saves itself; choosing it again retries.
        await context.setOffline(true);
        await eight.click();
        await expect(dialog.getByText(/offline/iu)).toBeVisible();
        await expect(eight).toBeChecked();
        await context.setOffline(false);
        await eight.click();
        await expect(
            dialog.getByText('We could not save your rating.', { exact: false }),
        ).toBeVisible();
        await expect(eight).toBeChecked();
        await signInMock(context, 'valid-rating-recovery');
        await eight.click();
        await expect(dialog.getByText('Personal Rating saved.')).toBeAttached();
    },
);
