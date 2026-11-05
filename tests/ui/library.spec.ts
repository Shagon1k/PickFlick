import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { captureSocialSignIn, signInMock } from './mock-session';
import { holdRoute, settle } from './settle';

for (const width of [390, 768, 1024, 1440]) {
    test(
        `Library tables and navigation stay bounded at ${width}`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width, height: 900 },
                hasTouch: true,
            });
            try {
                await signInMock(context, `valid-library-${width}`);
                const page = await context.newPage();
                await page.goto('/library', { waitUntil: 'load' });
                await expect(page.getByRole('table')).toHaveCount(1);
                await expect(page.getByRole('row')).toHaveCount(26);
                await expect(
                    page.getByRole('status').filter({ hasText: '28 rated films' }),
                ).toBeAttached();
                await expect(page.getByLabel('Previous page', { exact: true })).toHaveAttribute(
                    'aria-disabled',
                    'true',
                );
                const region = page.getByRole('region', { name: 'Rated films scroll region' });
                await region.focus();
                await expect(region).toBeFocused();
                await page.keyboard.press('ArrowRight');
                await settle(page);
                await expectNoPageOverflow(page);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await region.evaluate((element) => {
                    element.scrollLeft = 0;
                });
                await page.evaluate(() => window.scrollTo(0, 0));
                await settle(page);
                await page.getByRole('link', { name: 'Next page', exact: true }).tap();
                await expect(page).toHaveURL(/page=2/u);
                await expect(page.getByRole('row')).toHaveCount(4);
                await expect(page.getByLabel('Next page', { exact: true })).toHaveAttribute(
                    'aria-disabled',
                    'true',
                );
                await page
                    .getByRole('searchbox', { name: 'Search rated films…', exact: true })
                    .fill('Grand Budapest');
                await page
                    .getByRole('searchbox', { name: 'Search rated films…', exact: true })
                    .press('Enter');
                await expect(page.getByRole('row')).toHaveCount(2);
                await expect(page.getByText('Page 1 of 1')).toBeVisible();
                await page.reload();
                await expect(
                    page.getByRole('searchbox', { name: 'Search rated films…', exact: true }),
                ).toHaveValue('Grand Budapest');
                await page.goto('/library?tab=my-ratings&q=Grand+Budapest&score=8');
                await page
                    .getByRole('columnheader', { name: /^Film/u })
                    .getByRole('button')
                    .click();
                await expect(page.getByRole('columnheader', { name: /^Film/u })).toHaveAttribute(
                    'aria-sort',
                    'ascending',
                );
                const editor = page.getByRole('button', {
                    name: 'Your rating: 8 out of 10. Edit rating',
                });
                await editor.focus();
                await page.keyboard.press('Enter');
                const dialog = page.getByRole('dialog');
                await expect(dialog).toBeVisible();
                await dialog.getByRole('radio', { name: '9 of 10', exact: true }).check();
                await expect(
                    page.getByText('No films match your search or filters.', { exact: false }),
                ).toBeVisible();
                await expect(
                    page.getByRole('heading', { name: 'My Ratings', exact: true }),
                ).toBeFocused();
                await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
                await expect(page.getByRole('row')).toHaveCount(26);
                await page
                    .getByRole('searchbox', { name: 'Search rated films…', exact: true })
                    .fill('missing film');
                await page
                    .getByRole('searchbox', { name: 'Search rated films…', exact: true })
                    .press('Enter');
                await expect(
                    page.getByText('No films match your search or filters.', { exact: false }),
                ).toBeVisible();
            } finally {
                await context.close();
            }
        },
    );
}

test(
    'Library exposes invalid filters, read errors, and an empty Ratings view',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-empty-library');
        await page.goto('/library');
        await expect(page.getByText('No rated films yet.', { exact: false })).toBeVisible();
        await page.goto('/library?page=-1');
        await expect(page.getByRole('region', { name: 'Invalid Library filters' })).toBeVisible();
        await page.getByRole('link', { name: 'Clear filters' }).click();
        await expect(page.getByText('No rated films yet.', { exact: false })).toBeVisible();
        await signInMock(context, 'valid-library-unavailable');
        await page.goto('/library?q=retained');
        await expect(page.getByText('Your ratings are temporarily unavailable.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
            'href',
            /q=retained/u,
        );
        await context.clearCookies();
        await page.goto('/library?q=retained');
        await expect(page).toHaveURL(
            `/login?returnTo=${encodeURIComponent('/library?tab=my-ratings&sort=default&page=1&q=retained')}`,
        );
        await page.goto('/library?page=-1');
        await expect(page).toHaveURL(
            `/login?returnTo=${encodeURIComponent('/library?tab=my-ratings&sort=default&page=1')}`,
        );
    },
);

for (const { destination, expected } of [
    {
        destination: '/library?tab=my-ratings&q=Alien&score=8&priority=&sort=recent&page=2',
        expected: '/library?tab=my-ratings&sort=recent&page=2&q=Alien&score=8',
    },
    {
        destination:
            '/library?tab=watchlist&q=Alien+%26+Aliens&score=&priority=HIGH&sort=title&page=2',
        expected: '/library?tab=watchlist&sort=title&page=2&q=Alien+%26+Aliens&priority=HIGH',
    },
]) {
    test(
        `Library sign-in preserves and recovers ${destination}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            const readSignIn = await captureSocialSignIn(page);

            await page.goto(destination);
            await expect(page).toHaveURL(`/login?returnTo=${encodeURIComponent(expected)}`);
            await settle(page);
            await page.getByRole('button', { name: 'Continue with Google' }).click();
            await expect.poll(readSignIn).toMatchObject({
                provider: 'google',
                callbackURL: expected,
            });

            await signInMock(context, 'valid-library-sign-in');
            await page.reload();
            await expect(page).toHaveURL(expected);
            await expect(
                page.getByRole('searchbox', { name: /^Search (rated films|watchlist)…?$/u }),
            ).toHaveValue(new URLSearchParams(destination.split('?')[1]).get('q')!);
        },
    );
}

test(
    'Library rating failures preserve the selection and recover',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-library-errors');
        await page.goto('/library?q=Grand');
        await page.getByRole('button', { name: 'Your rating: 8 out of 10. Edit rating' }).click();
        const dialog = page.getByRole('dialog');
        const nine = dialog.getByRole('radio', { name: '9 of 10', exact: true });
        // A chosen star saves itself; choosing it again retries.
        await context.setOffline(true);
        await nine.click();
        await expect(dialog.getByText(/offline/iu)).toBeVisible();
        await context.setOffline(false);
        await nine.click();
        await expect(
            dialog.getByText('We could not save your rating.', { exact: false }),
        ).toBeVisible();
        await expect(nine).toBeChecked();
        await signInMock(context, 'valid-library-recovered');
        await nine.click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'My Ratings', exact: true })).toBeFocused();
        await expect(
            page.getByRole('button', { name: 'Your rating: 9 out of 10. Edit rating' }),
        ).toBeVisible();
    },
);

test(
    'Library search shows inert skeleton rows without losing input or local scroll',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-library-pending-search');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/library', { waitUntil: 'load' });
        await settle(page);
        const table = page.getByRole('table');
        const search = page.getByRole('searchbox', { name: /Search rated films/u });
        const region = page.getByRole('region', { name: 'Rated films scroll region' });
        await region.evaluate((element) => {
            element.scrollLeft = element.scrollWidth;
        });
        const scrollLeft = await region.evaluate((element) => element.scrollLeft);
        const release = await holdRoute(page, /\/library\?.*q=Grand/u);
        try {
            await search.fill('Grand');
            await search.press('Enter');
            await expect(table).toHaveAttribute('aria-busy', 'true');
            await expect(table.locator('tbody')).toHaveAttribute('inert', '');
            await expect(table.locator('tbody')).toHaveAttribute('aria-hidden', 'true');
            await expect(search).toBeFocused();
            expect(await region.evaluate((element) => element.scrollLeft)).toBe(scrollLeft);
            release();
            await expect(table).not.toHaveAttribute('aria-busy', 'true');
            await expect(
                table.getByRole('link', { name: 'The Grand Budapest Hotel', exact: true }),
            ).toBeVisible();
            await expect(search).toHaveValue('Grand');
            await expect(search).toBeFocused();
            expect(await region.evaluate((element) => element.scrollLeft)).toBe(scrollLeft);
        } finally {
            release();
        }
    },
);

test(
    'Library pagination starts a table transition while keeping navigation links',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-library-pending-page');
        await page.goto('/library');
        await expect(page.getByRole('row')).toHaveCount(26);
        const release = await holdRoute(page, /\/library\?.*page=2/u);
        try {
            await page.getByRole('link', { name: 'Next page', exact: true }).click();
            const table = page.getByRole('table');
            await expect(table).toHaveAttribute('aria-busy', 'true');
            await expect(table.locator('tbody tr')).toHaveCount(25);
            await expect(page.getByLabel('Next page', { exact: true })).toHaveAttribute(
                'aria-disabled',
                'true',
            );
            release();
            await expect(page).toHaveURL(/page=2/u);
            await expect(table).not.toHaveAttribute('aria-busy', 'true');
            await expect(table.getByRole('row')).toHaveCount(4);
        } finally {
            release();
        }
    },
);
