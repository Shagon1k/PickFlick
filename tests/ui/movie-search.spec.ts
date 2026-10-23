import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { settle } from './settle';

const MOVIE_ID = '10000000-0000-4000-8000-000000000037';

for (const width of [390, 768, 1024, 1440]) {
    test(
        `global search keyboard, encoded results and dismissal at ${width}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await page.setViewportSize({ width, height: 900 });
            await context.addCookies([
                {
                    name: 'pickflick.session_token',
                    value: `valid-search-${width}`,
                    domain: '127.0.0.1',
                    path: '/',
                },
            ]);
            await page.goto('/app', { waitUntil: 'load' });
            await settle(page);
            const trigger = page
                .getByRole('button', { name: 'Search films', exact: true })
                .filter({ visible: true });
            await trigger.click();
            const input = page.getByRole('combobox', { name: 'Search films' });
            await expect(input).toBeFocused();
            await input.fill('Film');
            await expect(
                page.getByRole('status').filter({ hasText: 'Searching films' }),
            ).toBeVisible();
            const first = page.getByRole('option', {
                name: '<script>alert(1)</script> & Film 2026',
            });
            await expect(first).toBeVisible();
            await expect(first).toHaveAttribute('href', `/movies/${MOVIE_ID}`);
            await expect(page.getByRole('option')).toHaveCount(2);
            await input.press('ArrowUp');
            await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
            await input.press('ArrowDown');
            await expect(first).toHaveAttribute('aria-selected', 'true');
            await settle(page);
            expect(
                (await new AxeBuilder({ page }).include('#shell-search').analyze()).violations,
            ).toEqual([]);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({ path: `test-results/search-${width}.png` });
            await input.press('Escape');
            await expect(trigger).toBeFocused();
            await trigger.click();
            await expect(input).toHaveValue('');
            await input.fill('Film');
            await expect(first).toBeVisible();
            await input.fill('Film ');
            await expect(first).toBeVisible();
            await input.press('ArrowDown');
            await input.press('Enter');
            await expect(page).toHaveURL(`/movies/${MOVIE_ID}`);
            await expect(
                page.getByRole('heading', {
                    name: '<script>alert(1)</script> & Film',
                    exact: true,
                }),
            ).toBeVisible();
        },
    );
}

test('search states, stale-response suppression, outside dismissal and mutual exclusion', async ({
    context,
    page,
}) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-search-states',
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
    await page.goto('/app', { waitUntil: 'load' });
    await settle(page);
    const trigger = page
        .getByRole('button', { name: 'Search films', exact: true })
        .filter({ visible: true });
    await trigger.click();
    const input = page.getByRole('combobox', { name: 'Search films' });
    await input.fill('empty');
    await expect(page.getByText('No films found. Try another title.')).toBeVisible();
    await input.fill('outage');
    await expect(
        page.getByText('The film provider is temporarily unavailable. Try again.'),
    ).toBeVisible();
    await input.fill('limited');
    await expect(page.getByText('Film search is busy. Please try again shortly.')).toBeVisible();
    await input.fill('disabled');
    await expect(page.getByText('Film search is not configured yet.')).toBeVisible();
    await input.fill('stale');
    await expect(
        page.getByText('Showing cached results while the provider is unavailable.'),
    ).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(2);
    const slowRequest = page.waitForRequest(
        (request) => request.method() === 'POST' && (request.postData()?.includes('slow') ?? false),
    );
    await input.fill('slow');
    await slowRequest;
    await input.fill('empty');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(page.getByText('No films found. Try another title.')).toBeVisible();
    await expect(page.getByText('Old film')).toHaveCount(0);
    await page.getByRole('heading', { level: 1 }).click();
    await expect(input).toBeHidden();
    await page
        .getByRole('button', { name: 'Notifications', exact: true })
        .filter({ visible: true })
        .click();
    await expect(page.locator('#shell-notifications')).toBeVisible();
    await trigger.click();
    await expect(input).toBeVisible();
    await expect(page.locator('#shell-notifications')).toBeHidden();
});

test('touch result navigation and anonymous Movie route', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`/movies/${MOVIE_ID}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=/movies/${MOVIE_ID}$`, 'u'));
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-search-touch',
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
    await page.goto('/app', { waitUntil: 'load' });
    await settle(page);
    await page
        .getByRole('button', { name: 'Search films', exact: true })
        .filter({ visible: true })
        .tap();
    await page.getByRole('combobox', { name: 'Search films' }).fill('Film');
    await page.getByRole('option').first().tap();
    await expect(page).toHaveURL(`/movies/${MOVIE_ID}`);
    await context.close();
});

test('search renders available same-origin posters and preserves film rows when an image fails', async ({
    context,
    page,
}) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-search-posters',
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
    await page.route('**/api/movies/*/poster', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'image/png',
            body: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                'base64',
            ),
        }),
    );
    await page.goto('/app');
    await page
        .getByRole('button', { name: 'Search films', exact: true })
        .filter({ visible: true })
        .click();
    await page.getByRole('combobox', { name: 'Search films' }).fill('posters');
    const options = page.getByRole('option');
    await expect(options).toHaveCount(2);
    await expect(options.first().locator('img')).toHaveAttribute(
        'src',
        /\/api\/movies\/[^/]+\/poster$/u,
    );
    await expect
        .poll(() =>
            options
                .first()
                .locator('img')
                .evaluate((element: HTMLImageElement) => element.naturalWidth),
        )
        .toBeGreaterThan(0);
    await page.route('**/api/movies/*/poster', (route) => route.abort());
    await page.getByRole('combobox', { name: 'Search films' }).fill('empty');
    await expect(options).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Search films' }).fill('posters-broken');
    await expect(options).toHaveCount(2);
    await expect(options.first()).toContainText('PF');
    await expect(options.first()).toContainText('Film');
});
