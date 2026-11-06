import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { holdRoute, settle } from './settle';

const CLUB_ID = '10000000-0000-4000-8000-000000000031';
const PATH = `/clubs/${CLUB_ID}/ratings`;

for (const width of [390, 768, 1024, 1440]) {
    test(
        `Club Ratings sorting and table stay accessible at ${width}`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width, height: 900 },
                hasTouch: true,
            });
            try {
                await signInMock(context, `valid-hub-ratings-${width}`);
                const page = await context.newPage();
                await page.goto(PATH, { waitUntil: 'load' });
                await expect(page.getByRole('row')).toHaveCount(26);
                await expect(page.getByLabel('Previous page', { exact: true })).toHaveAttribute(
                    'aria-disabled',
                    'true',
                );
                await expect(page.getByRole('row').nth(1)).toContainText('Synthetic film 28');
                const region = page.getByRole('region', {
                    name: 'Club rating leaderboard scroll region',
                });
                await region.focus();
                await expect(region).toBeFocused();
                await page.keyboard.press('ArrowRight');
                const film = page.getByRole('link', { name: 'Synthetic film 28', exact: true });
                expect((await film.boundingBox())?.height).toBeGreaterThanOrEqual(44);
                await settle(page);
                await expectNoPageOverflow(page);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await region.evaluate((element) => {
                    element.scrollLeft = 0;
                });
                await page.getByRole('link', { name: 'Next page', exact: true }).tap();
                await expect(page).toHaveURL(/page=2/u);
                await expect(page.getByRole('row')).toHaveCount(4);
                await page.getByRole('columnheader', { name: /^Film/u }).getByRole('button').tap();
                await expect(page).toHaveURL(/sort=title&page=1/u);
                await expect(page.getByRole('row').nth(1)).toContainText('Synthetic film 01');
                await page.reload();
                await expect(page.getByRole('columnheader', { name: /^Film/u })).toHaveAttribute(
                    'aria-sort',
                    'ascending',
                );
                await context.setOffline(true);
                await page.getByRole('columnheader', { name: /^Film/u }).getByRole('button').tap();
                await expect(
                    page.getByRole('status').filter({ hasText: /offline/iu }),
                ).toBeAttached();
                await context.setOffline(false);
                await page.getByRole('columnheader', { name: /^Film/u }).getByRole('button').tap();
                await expect(page).toHaveURL(/sort=title.*direction=desc/u);
                await expect(page.getByRole('row').nth(1)).toContainText('Synthetic film 28');
                await expect(page.getByRole('columnheader', { name: /^Film/u })).toHaveAttribute(
                    'aria-sort',
                    'descending',
                );
                await expect(
                    page.getByRole('columnheader', { name: /^Film/u }).getByRole('button'),
                ).toBeEnabled();
            } finally {
                await context.close();
            }
        },
    );
}

test(
    'Club Ratings empty, invalid and unavailable states',
    { tag: '@smoke' },
    async ({ context, page }) => {
        for (const [token, copy] of [
            ['valid-hub-ratings-empty', 'No rated films yet.'],
            ['valid-hub-ratings-unavailable', 'Club Ratings are temporarily unavailable'],
            ['valid-hub-ratings-denied', 'Club access unavailable'],
        ] as const) {
            await signInMock(context, token);
            await page.goto(PATH);
            await expect(page.getByText(copy, { exact: false })).toBeVisible();
        }
        await page.goto(`${PATH}?sort=invalid`);
        await expect(page.getByRole('region', { name: 'Invalid ratings filters' })).toBeVisible();
        await page.getByRole('link', { name: 'Clear filters' }).click();
        await expect(page).toHaveURL(PATH);
    },
);

test('Club Ratings sign-in preserves the requested sort and page', async ({ page }) => {
    await page.goto(`${PATH}?sort=title&page=2`);
    await expect(page).toHaveURL(/\/login\?returnTo=/u);
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe(`${PATH}?sort=title&page=2`);
});

test('Club Ratings can retry an API failure and Overview shows every statistic', async ({
    context,
    page,
}) => {
    await signInMock(context, `valid-hub-ratings-ratings-transient-${crypto.randomUUID()}`);
    await page.goto(PATH);
    await expect(
        page.getByRole('heading', { name: 'Club Ratings are temporarily unavailable' }),
    ).toBeVisible();
    await settle(page);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await page.goto(`/clubs/${CLUB_ID}`);
    await expect(
        page.getByRole('region', { name: 'Club statistics' }).locator('strong'),
    ).toHaveCount(7);
});

test('Ratings navigation keeps the Hub frame and shows its loading boundary', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-hub-ratings-loading');
    const isPrefetch = (headers: Record<string, string>) =>
        Object.keys(headers).some((name) => name.includes('prefetch'));
    const prefetched = page.waitForResponse(
        (response) => response.url().includes(PATH) && isPrefetch(response.request().headers()),
    );
    await page.goto(`/clubs/${CLUB_ID}`);
    await prefetched;
    const release = await holdRoute(
        page,
        `**${PATH}**`,
        (request) => !isPrefetch(request.headers()),
    );
    await page
        .getByRole('navigation', { name: 'Club sections' })
        .getByRole('link', { name: 'Ratings', exact: true })
        .click();
    const skeleton = page.getByRole('status').filter({ hasText: 'Loading Club ratings' });
    await expect(skeleton).toBeVisible();
    await expect(page.getByText('Call sheet 001', { exact: true })).toBeVisible();
    release();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(skeleton).toHaveCount(0);
});
