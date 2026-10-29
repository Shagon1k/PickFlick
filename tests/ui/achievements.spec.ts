import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';

const CLUB_ID = '10000000-0000-4000-8000-000000000031';
for (const width of [390, 768, 1024, 1440]) {
    test(
        `Achievement shelves and filters work at ${width}`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width, height: 900 },
                hasTouch: true,
            });
            try {
                await signInMock(context, `valid-hub-achievements-${width}`);
                const page = await context.newPage();
                for (const path of [
                    '/library?tab=achievements',
                    `/clubs/${CLUB_ID}/achievements`,
                ]) {
                    await page.goto(path);
                    const shelf = page.getByRole('region', { name: 'Achievements', exact: true });
                    await expect(shelf.getByRole('article')).toHaveCount(6);
                    await expect(
                        shelf
                            .getByRole('article', { name: 'Critics Circle', exact: true })
                            .getByText('Result-based Club achievements', { exact: false })
                            .first(),
                    ).toBeVisible();
                    const masked = shelf.getByRole('article', {
                        name: 'Critics Circle',
                        exact: true,
                    });
                    await expect(
                        masked.getByText('Result-based Club achievements', { exact: false }),
                    ).toHaveCount(1);
                    await expect(masked.locator('details')).toHaveCount(0);
                    await settle(page);
                    expect(
                        await page.evaluate(
                            () => document.documentElement.scrollWidth <= innerWidth,
                        ),
                    ).toBe(true);
                    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                    const unlocked = shelf.getByRole('button', { name: '1 Unlocked', exact: true });
                    await unlocked.focus();
                    await page.keyboard.press('Enter');
                    await expect(unlocked).toHaveAttribute('aria-pressed', 'false');
                    await shelf.getByRole('button', { name: '2 In progress', exact: true }).tap();
                    await shelf.getByRole('button', { name: '3 Not started', exact: true }).tap();
                    await expect(
                        shelf.getByText('No achievements match these filters.', { exact: false }),
                    ).toBeVisible();
                    await unlocked.tap();
                    await expect(shelf.getByRole('article')).toHaveCount(1);
                    await shelf.getByText('How this is calculated · v1').click();
                    await expect(
                        shelf.getByText('Earned history is retained.', { exact: false }),
                    ).toBeVisible();
                    await page.reload();
                    await expect(shelf.getByRole('article')).toHaveCount(6);
                    await page.evaluate(() => window.scrollTo(0, 0));
                    await settle(page);
                    await page.screenshot({
                        path: `test-results/achievements-${path.startsWith('/library') ? 'library' : 'club'}-${width}.png`,
                        fullPage: true,
                    });
                }
            } finally {
                await context.close();
            }
        },
    );
}

test(
    'Achievement views recover from read failures and handle empty and denied states',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-achievements-transient');
        await page.goto('/library?tab=achievements');
        await expect(page.getByRole('region', { name: 'Achievements unavailable' })).toBeVisible();
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(page.getByRole('article')).toHaveCount(6);
        await signInMock(context, 'valid-achievements-empty');
        await page.goto('/library?tab=achievements');
        await expect(page.getByRole('status')).toHaveText('0 of 0 achievements shown');
        await expect(page.getByText('0%', { exact: true })).toBeVisible();
        await signInMock(context, 'valid-hub-achievements-denied');
        await page.goto(`/clubs/${CLUB_ID}/achievements`);
        await expect(page.getByRole('heading', { name: 'Club access unavailable' })).toBeVisible();
        await signInMock(context, 'valid-achievements-stats-unavailable');
        await page.goto('/library?tab=achievements');
        await expect(page.getByRole('article')).toHaveCount(6);
        await expect(
            page.getByRole('region', { name: 'Personal statistics unavailable' }),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: 'Retry statistics' })).toHaveAttribute(
            'href',
            '/library?tab=achievements',
        );
        await context.clearCookies();
        await page.goto('/library?tab=achievements');
        await expect(page).toHaveURL(/\/login\?returnTo=%2Flibrary%3Ftab%3Dachievements/u);
    },
);
