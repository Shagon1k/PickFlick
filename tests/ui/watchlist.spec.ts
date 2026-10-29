import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';

const MOVIE_ID = '10000000-0000-4000-8000-000000000037';

for (const width of [390, 768, 1024, 1440]) {
    test(
        `Watchlist stays consistent across Movie and Library at ${width}`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width, height: 900 },
                hasTouch: true,
            });
            try {
                await signInMock(context, `valid-watchlist-${width}`);
                const page = await context.newPage();
                await page.route('**/api/movies/images/**', (route) => route.abort());
                await page.goto(`/movies/${MOVIE_ID}`, { waitUntil: 'load' });
                const trigger = page.getByRole('button', { name: 'Add to watchlist', exact: true });
                await trigger.focus();
                await page.keyboard.press('Enter');
                const dialog = page.getByRole('dialog');
                await expect(
                    dialog.getByRole('button', { name: 'Medium', exact: true }),
                ).toHaveAttribute('aria-pressed', 'true');
                await dialog.getByRole('button', { name: 'High', exact: true }).tap();
                await expect(dialog).toHaveCount(0);
                const saved = page.getByRole('button', {
                    name: 'Edit watchlist priority',
                    exact: true,
                });
                await expect(saved).toHaveAttribute('aria-pressed', 'true');
                await expect(saved).toBeFocused();
                await saved.click();
                await expect(
                    dialog.getByRole('button', { name: 'High', exact: true }),
                ).toHaveAttribute('aria-pressed', 'true');
                await settle(page);
                const targetSizes = await dialog
                    .getByRole('button')
                    .evaluateAll((buttons) =>
                        buttons.map((button) => button.getBoundingClientRect().height),
                    );
                expect(targetSizes.every((height) => height >= 44)).toBe(true);
                expect(
                    await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
                ).toBe(true);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await page.screenshot({
                    path: `test-results/watchlist-movie-${width}.png`,
                    fullPage: true,
                });
                await page.keyboard.press('Escape');
                await expect(saved).toBeFocused();
                await page.goto('/library?tab=watchlist', { waitUntil: 'load' });
                const row = page.getByRole('row').filter({
                    has: page.getByRole('link', {
                        name: 'The Grand Budapest Hotel',
                        exact: true,
                    }),
                });
                await expect(
                    row.getByRole('button', { name: 'Edit watchlist priority' }),
                ).toHaveText('High');
                await row.getByRole('button', { name: 'Edit watchlist priority' }).tap();
                await dialog.getByRole('button', { name: 'Low', exact: true }).tap();
                await expect(
                    row.getByRole('button', { name: 'Edit watchlist priority' }),
                ).toHaveText('Low');
                await settle(page);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                await page.screenshot({
                    path: `test-results/watchlist-library-${width}.png`,
                    fullPage: true,
                });
                await row.getByRole('link').click();
                await page
                    .getByRole('button', { name: 'Edit watchlist priority', exact: true })
                    .click();
                await expect(
                    dialog.getByRole('button', { name: 'Low', exact: true }),
                ).toHaveAttribute('aria-pressed', 'true');
                await dialog.getByRole('button', { name: 'Remove from watchlist' }).tap();
                await expect(
                    page.getByRole('button', { name: 'Add to watchlist', exact: true }),
                ).toHaveAttribute('aria-pressed', 'false');
                await page.goto('/library?tab=watchlist');
                await expect(
                    page.getByText('Your Watchlist is empty.', { exact: false }),
                ).toBeVisible();
            } finally {
                await context.close();
            }
        },
    );
}

test(
    'Watchlist failures preserve unsaved state and allow recovery; Library removal restores focus',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const cookie = { name: 'pickflick.session_token', domain: '127.0.0.1', path: '/' };
        await context.addCookies([{ ...cookie, value: 'valid-watchlist-failure' }]);
        await page.route('**/api/movies/images/**', (route) => route.abort());
        await page.goto(`/movies/${MOVIE_ID}`);
        await context.setOffline(true);
        await page.getByRole('button', { name: 'Add to watchlist', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText(/offline/iu)).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Add to watchlist', exact: true }),
        ).toHaveAttribute('aria-pressed', 'false');
        await context.setOffline(false);
        await dialog.getByRole('button', { name: 'High', exact: true }).click();
        await expect(
            dialog.getByText('We could not update your Watchlist. Try again.'),
        ).toBeVisible();
        await context.addCookies([{ ...cookie, value: 'valid-watchlist-recovery' }]);
        await dialog.getByRole('button', { name: 'High', exact: true }).click();
        await expect(
            page.getByRole('button', { name: 'Edit watchlist priority', exact: true }),
        ).toBeVisible();
        await page.goto('/library?tab=watchlist');
        await page.getByRole('button', { name: 'Edit watchlist priority' }).click();
        await dialog.getByRole('button', { name: 'Remove from watchlist' }).click();
        await expect(page.getByText('Your Watchlist is empty.', { exact: false })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Watchlist', exact: true })).toBeFocused();
    },
);

test(
    'Library gives a retry on read failure and redirects anonymous visitors',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-watchlist-unavailable');
        await page.goto('/library?tab=watchlist');
        await expect(page.getByText('Your Watchlist is temporarily unavailable.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
        await context.clearCookies();
        await page.goto('/library?tab=watchlist');
        await expect(page).toHaveURL(/\/login\?returnTo=/u);
    },
);
