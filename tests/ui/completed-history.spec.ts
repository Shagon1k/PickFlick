import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports } from './viewports';

const SESSION_ROUTE = '/sessions/30000000-0000-4000-8000-000000000050';
const HUB_ROUTE = '/clubs/10000000-0000-4000-8000-000000000031/sessions';

async function authenticate(context: BrowserContext, value: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

for (const viewport of canonicalViewports) {
    test(
        `Completed keeps screening facts, ratings and frozen nominations at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await authenticate(context, 'valid-rating-history-completed');
            await page.setViewportSize(viewport);
            await page.goto(SESSION_ROUTE, { waitUntil: 'load' });
            // The long synopsis puts lazy rival posters beyond the initial loading range on phones.
            await page.getByRole('heading', { name: 'Nomination Rivals' }).scrollIntoViewIfNeeded();
            await settle(page);
            await expect(
                page.getByRole('heading', { name: 'Session Details', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('region', { name: 'Session details', exact: true }),
            ).toContainText('Jordan • Casey • Morgan');
            await expect(
                page.getByRole('region', { name: 'Session details', exact: true }),
            ).toContainText('Bring snacks.');
            await expect(page.getByText('A memorable screening.')).toBeVisible();
            const rivals = page.getByRole('region', { name: 'Nomination Rivals' });
            await expect(rivals.getByText('The rival nomination')).toBeVisible();
            const score = rivals
                .getByRole('button', { name: /^Average vote .* Show votes$/u })
                .first();
            await score.press('Enter');
            await expect(page.getByRole('dialog').filter({ hasText: 'Top scores' })).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.getByRole('button', { name: 'Submit Rating' })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({
                path: `test-results/completed-history-${viewport.name}.png`,
                fullPage: true,
            });
        },
    );

    test(
        `Hub separates a blocking Session, all Ratings and partial history at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await authenticate(context, 'valid-hub-history');
            await page.setViewportSize(viewport);
            await page.goto(HUB_ROUTE, { waitUntil: 'load' });
            await settle(page);
            await expect(
                page.getByRole('region', { name: 'Active Session', exact: true }),
            ).toContainText('Nomination');
            const ratings = page.getByRole('region', { name: 'Active Ratings' });
            await expect(ratings.getByRole('link')).toHaveCount(2);
            await expect(ratings.getByText('1 of 2 rated', { exact: true })).toBeVisible();
            const history = page.getByRole('region', { name: 'History', exact: true });
            await expect(history.getByRole('link')).toHaveCount(2);
            await expect(history.getByText('8.0', { exact: true })).toBeVisible();
            await expect(history.getByText('—', { exact: true })).toBeVisible();
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({
                path: `test-results/hub-history-${viewport.name}.png`,
                fullPage: true,
            });
        },
    );
}

test('Completed hidden results disclose no other comments, nominees or vote totals', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-rating-history-hidden-completed');
    await page.goto(SESSION_ROUTE);
    await expect(page.getByText('Votes are hidden for this Session.')).toBeVisible();
    await expect(page.getByText('A memorable screening.')).toHaveCount(0);
    await expect(page.getByText('The rival nomination')).toHaveCount(0);
    await expect(page.getByText(/Winner nominated by/)).toHaveCount(0);
});

test('Hub history keeps hidden scores unavailable', async ({ context, page }) => {
    await authenticate(context, 'valid-hub-history-hidden');
    await page.goto(HUB_ROUTE);
    const history = page.getByRole('region', { name: 'History', exact: true });
    await expect(history.getByText('—', { exact: true })).toHaveCount(2);
    await expect(history.getByText('8.0', { exact: true })).toHaveCount(0);
});

test('Hub Sessions explains empty Rating and history collections', async ({ context, page }) => {
    await authenticate(context, 'valid-hub-empty');
    await page.goto(HUB_ROUTE);
    await expect(page.getByText('No Sessions awaiting ratings.')).toBeVisible();
    await expect(page.getByText('No completed Sessions yet.')).toBeVisible();
});
