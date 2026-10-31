import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';

for (const width of [390, 768, 1024, 1440]) {
    test(
        `Personal statistics remain readable and bounded at ${width}`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width, height: 900 },
                hasTouch: true,
            });
            try {
                await signInMock(context, `valid-library-stats-final-${width}`);
                const page = await context.newPage();
                await page.goto('/library?q=Grand&score=8');
                const statistics = page.getByRole('region', {
                    name: 'Personal statistics',
                    exact: true,
                });
                await expect(statistics.locator('dt')).toHaveCount(8);
                await expect(statistics.locator('dd').nth(0)).toHaveText('28');
                await expect(statistics.locator('dd').nth(2)).toHaveText('8.0');
                await expect(
                    statistics.getByText('DirectorWithAVeryLongUnbrokenName'.repeat(4)),
                ).toBeVisible();
                await settle(page);
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                expect(
                    await statistics
                        .locator('dd[data-text]')
                        .evaluateAll((elements) =>
                            elements.every((element) => element.scrollWidth <= element.clientWidth),
                        ),
                ).toBe(true);
                const columns = await statistics
                    .getByRole('list')
                    .evaluate(
                        (element) =>
                            getComputedStyle(element).gridTemplateColumns.split(' ').length,
                    );
                expect(columns).toBe(width < 1024 ? 2 : 4);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await page.screenshot({
                    path: `test-results/library-statistics-${width}.png`,
                    fullPage: true,
                });
                await page.goto('/library?tab=watchlist');
                await expect(page).toHaveURL(/tab=watchlist/u);
                await expect(statistics.locator('dd').nth(0)).toHaveText('28');
                await page.reload();
                await expect(statistics.locator('dd').nth(0)).toHaveText('28');
                await page.goto('/library');
                await page.getByLabel('Search rated films').fill('Grand');
                await page.getByLabel('Search rated films').press('Enter');
                await expect(page).toHaveURL(/q=Grand/u);
                await page
                    .getByRole('button', { name: 'Your rating: 8 out of 10. Edit rating' })
                    .focus();
                await page.keyboard.press('Enter');
                const dialog = page.getByRole('dialog');
                await dialog.getByRole('radio', { name: '10 of 10', exact: true }).check();
                await expect(dialog).toHaveCount(0);
                await expect(statistics.locator('dd').nth(2)).toHaveText('8.1');
            } finally {
                await context.close();
            }
        },
    );
}

test(
    'Personal statistics timeouts preserve the Library table and filters',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-library-statistics-timeout');
        await page.goto('/library?q=Grand&score=8');
        await expect(
            page.getByRole('region', { name: 'Personal statistics unavailable' }),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'Retry statistics', exact: true }),
        ).toHaveAttribute(
            'href',
            '/library?tab=my-ratings&q=Grand&score=8&priority=&sort=default&page=1',
        );
        await expect(page.getByRole('table')).toBeVisible();
        await expect(page.getByRole('row')).toHaveCount(2);
        await expect(page.getByLabel('Search rated films')).toHaveValue('Grand');
        await expect(page.getByLabel('Search rated films')).toBeEnabled();
    },
);

test(
    'Personal statistics show empty values and recover from read failure',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const cookie = { name: 'pickflick.session_token', domain: '127.0.0.1', path: '/' };
        await context.addCookies([{ ...cookie, value: 'valid-empty-statistics' }]);
        await page.goto('/library');
        const statistics = page.getByRole('region', { name: 'Personal statistics', exact: true });
        await expect(statistics.locator('dd')).toHaveText(['0', '0', '—', '0', '0', '—', '—', '—']);
        await expect(statistics.getByText(/Rate a film to start/u)).toBeVisible();
        await context.addCookies([{ ...cookie, value: 'valid-library-unavailable' }]);
        await page.reload();
        await expect(
            page.getByRole('region', { name: 'Personal statistics unavailable' }),
        ).toBeVisible();
        await expect(statistics).toHaveCount(0);
        await context.addCookies([{ ...cookie, value: 'valid-empty-statistics-recovered' }]);
        await page.getByRole('link', { name: 'Retry statistics', exact: true }).click();
        await expect(statistics.locator('dd').first()).toHaveText('0');
    },
);

test(
    'Library starts statistics and tab content concurrently',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-parallel-library');
        await page.goto('/library');
        await expect(
            page.getByRole('region', { name: 'Personal statistics', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('table')).toBeVisible();
    },
);

test(
    'Library table timeouts preserve statistics and show the existing recovery state',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-library-table-timeout');
        await page.goto('/library?q=Grand&score=8');
        await expect(
            page.getByRole('region', { name: 'Personal statistics', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('region', { name: 'My Ratings unavailable' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Try again', exact: true })).toHaveAttribute(
            'href',
            '/library?tab=my-ratings&q=Grand&score=8&priority=&sort=default&page=1',
        );
    },
);
