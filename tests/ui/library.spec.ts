import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';

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
                await expect(page.getByRole('status')).toContainText('28 films rated');
                await expect(page.locator('a').filter({ hasText: /^Previous$/u })).toHaveAttribute(
                    'aria-disabled',
                    'true',
                );
                const region = page.getByRole('region', { name: 'Rated films scroll region' });
                await region.focus();
                await expect(region).toBeFocused();
                await page.keyboard.press('ArrowRight');
                await settle(page);
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await region.evaluate((element) => {
                    element.scrollLeft = 0;
                });
                await page.evaluate(() => window.scrollTo(0, 0));
                await settle(page);
                await page.screenshot({
                    path: `test-results/library-ratings-${width}.png`,
                    fullPage: true,
                });
                await page.getByRole('link', { name: 'Next', exact: true }).tap();
                await expect(page).toHaveURL(/page=2/u);
                await expect(page.getByRole('row')).toHaveCount(4);
                await expect(page.locator('a').filter({ hasText: /^Next$/u })).toHaveAttribute(
                    'aria-disabled',
                    'true',
                );
                await page.getByLabel('Search rated films').fill('Grand Budapest');
                await page.getByRole('button', { name: 'Apply', exact: true }).click();
                await expect(page.getByRole('row')).toHaveCount(2);
                await expect(page.getByText('Page 1 of 1')).toBeVisible();
                await page.reload();
                await expect(page.getByLabel('Search rated films')).toHaveValue('Grand Budapest');
                await page.getByRole('combobox', { name: 'Rating', exact: true }).click();
                await page.getByRole('option', { name: '8/10', exact: true }).click();
                await page.getByRole('combobox', { name: 'Sort by', exact: true }).click();
                await page.getByRole('option', { name: 'Film A to Z' }).click();
                await page.getByRole('button', { name: 'Apply', exact: true }).click();
                const editor = page.getByRole('button', {
                    name: 'Your rating: 8 out of 10. Edit rating',
                });
                await editor.focus();
                await page.keyboard.press('Enter');
                const dialog = page.getByRole('dialog');
                await expect(dialog).toBeVisible();
                await dialog.getByRole('radio', { name: '9 of 10', exact: true }).check();
                await dialog.getByRole('button', { name: 'Save rating', exact: true }).tap();
                await expect(
                    page.getByText('No films match your search or filters.', { exact: false }),
                ).toBeVisible();
                await expect(
                    page.getByRole('heading', { name: 'My Ratings', exact: true }),
                ).toBeFocused();
                await page.getByRole('link', { name: 'Clear', exact: true }).click();
                await expect(page.getByRole('row')).toHaveCount(26);
                await page.getByLabel('Search rated films').fill('missing film');
                await page.getByRole('button', { name: 'Apply', exact: true }).click();
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
        const cookie = { name: 'pickflick.session_token', domain: '127.0.0.1', path: '/' };
        await context.addCookies([{ ...cookie, value: 'valid-empty-library' }]);
        await page.goto('/library');
        await expect(page.getByText('No rated films yet.', { exact: false })).toBeVisible();
        await page.goto('/library?page=-1');
        await expect(page.getByRole('region', { name: 'Invalid Library filters' })).toBeVisible();
        await page.getByRole('link', { name: 'Clear filters' }).click();
        await expect(page.getByText('No rated films yet.', { exact: false })).toBeVisible();
        await context.addCookies([{ ...cookie, value: 'valid-library-unavailable' }]);
        await page.goto('/library?q=retained');
        await expect(page.getByText('Your ratings are temporarily unavailable.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
            'href',
            /q=retained/u,
        );
        await context.clearCookies();
        await page.goto('/library?q=retained');
        await expect(page).toHaveURL(
            `/login?returnTo=${encodeURIComponent('/library?tab=my-ratings&q=retained&score=&priority=&sort=default&page=1')}`,
        );
        await page.goto('/library?page=-1');
        await expect(page).toHaveURL(
            `/login?returnTo=${encodeURIComponent('/library?tab=my-ratings&q=&score=&priority=&sort=default&page=1')}`,
        );
    },
);

for (const destination of [
    '/library?tab=my-ratings&q=Alien&score=8&priority=&sort=recent&page=2',
    '/library?tab=watchlist&q=Alien+%26+Aliens&score=&priority=HIGH&sort=title&page=2',
]) {
    test(
        `Library sign-in preserves and recovers ${destination}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            let requestBody: Record<string, unknown> | undefined;
            await page.route('**/api/auth/sign-in/social', async (route) => {
                requestBody = route.request().postDataJSON() as Record<string, unknown>;
                await route.fulfill({ json: { redirect: false } });
            });

            await page.goto(destination);
            await expect(page).toHaveURL(`/login?returnTo=${encodeURIComponent(destination)}`);
            await page.getByRole('button', { name: 'Continue with Google' }).click();
            await expect
                .poll(() => requestBody)
                .toMatchObject({
                    provider: 'google',
                    callbackURL: destination,
                });

            await signInMock(context, 'valid-library-sign-in');
            await page.reload();
            await expect(page).toHaveURL(destination);
            await expect(
                page.getByRole('searchbox', { name: /^Search (rated films|watchlist)$/u }),
            ).toHaveValue(new URLSearchParams(destination.split('?')[1]).get('q')!);
        },
    );
}

test(
    'Library rating failures preserve the selection and recover',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const cookie = { name: 'pickflick.session_token', domain: '127.0.0.1', path: '/' };
        await context.addCookies([{ ...cookie, value: 'valid-library-errors' }]);
        await page.goto('/library?q=Grand');
        await page.getByRole('button', { name: 'Your rating: 8 out of 10. Edit rating' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('radio', { name: '9 of 10', exact: true }).click();
        await context.setOffline(true);
        await dialog.getByRole('button', { name: 'Save rating', exact: true }).click();
        await expect(dialog.getByText(/offline/iu)).toBeVisible();
        await context.setOffline(false);
        await dialog.getByRole('button', { name: 'Save rating', exact: true }).click();
        await expect(
            dialog.getByText('We could not save your rating.', { exact: false }),
        ).toBeVisible();
        await expect(dialog.getByRole('radio', { name: '9 of 10', exact: true })).toBeChecked();
        await context.addCookies([{ ...cookie, value: 'valid-library-recovered' }]);
        await dialog.getByRole('button', { name: 'Save rating', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'My Ratings', exact: true })).toBeFocused();
        await expect(
            page.getByRole('button', { name: 'Your rating: 9 out of 10. Edit rating' }),
        ).toBeVisible();
    },
);
