import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { settle } from './settle';

const MOVIE_ID = '10000000-0000-4000-8000-000000000037';

test(
    'Bookmark hover stays still and pending updates do not resize the priority popover',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, `valid-watchlist-stable-layout-${crypto.randomUUID()}`);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/movies/${MOVIE_ID}`, { waitUntil: 'load' });
        await settle(page);
        const ribbon = page.getByRole('button', { name: 'Add to watchlist', exact: true });
        const resting = await ribbon.boundingBox();
        expect(resting).not.toBeNull();
        await ribbon.hover();
        await settle(page);
        expect(await ribbon.boundingBox()).toEqual(resting);
        await ribbon.dispatchEvent('pointerdown', { button: 0, isPrimary: true });
        await ribbon.evaluate((element) => {
            for (const animation of element.getAnimations({ subtree: true })) {
                animation.pause();
                animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
            }
        });
        expect(await ribbon.boundingBox()).toEqual(resting);
        await ribbon.evaluate((element) => {
            for (const animation of element.getAnimations({ subtree: true })) animation.finish();
        });
        let release = () => {};
        let hasCaptured = false;
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.route(`**/movies/${MOVIE_ID}`, async (route) => {
            if (route.request().method() === 'POST') {
                hasCaptured = true;
                await held;
            }
            await route.continue();
        });
        try {
            await ribbon.click();
            await expect.poll(() => hasCaptured).toBe(true);
            await expect(ribbon).toHaveAttribute('aria-busy', 'true');
            const dialog = page.getByRole('dialog').filter({
                has: page.getByRole('group', { name: 'Watchlist priority', exact: true }),
            });
            await expect(dialog).toBeVisible();
            await settle(page);
            const pending = await dialog.boundingBox();
            expect(pending).not.toBeNull();
            const progress = dialog.getByRole('status');
            await expect(progress).toHaveText('Updating your Watchlist…');
            expect(
                await progress.evaluate((element) => element.getBoundingClientRect().height),
            ).toBeLessThanOrEqual(1);
            release();
            const savedRibbon = page.getByRole('button', {
                name: 'Edit watchlist priority',
                exact: true,
            });
            await expect(savedRibbon).not.toHaveAttribute('aria-busy', 'true');
            await expect(
                dialog.getByRole('button', { name: 'Medium', exact: true }),
            ).toHaveAttribute('aria-pressed', 'true');
            await expect(progress).toHaveText('Watchlist saved.');
            expect(
                await progress.evaluate((element) => element.getBoundingClientRect().height),
            ).toBeLessThanOrEqual(1);
            await settle(page);
            const saved = await dialog.boundingBox();
            expect(saved).not.toBeNull();
            expect(Math.abs(pending!.height - saved!.height)).toBeLessThanOrEqual(1);
            await savedRibbon.hover();
            await settle(page);
            expect(await savedRibbon.boundingBox()).toEqual(resting);
        } finally {
            release();
        }
    },
);

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
                await signInMock(context, `valid-watchlist-${width}-${crypto.randomUUID()}`);
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
                await expectNoPageOverflow(page);
                await row.getByRole('link').click();
                await expect(page).toHaveURL(`/movies/${MOVIE_ID}`);
                await page
                    .getByRole('region', { name: '<script>alert(1)</script> & Film', exact: true })
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
                    page
                        .getByRole('table', { name: 'Films to watch', exact: true })
                        .getByText('Your Watchlist is empty.', { exact: false }),
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
        await signInMock(context, 'valid-watchlist-failure');
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
        await signInMock(context, 'valid-watchlist-recovery');
        await dialog.getByRole('button', { name: 'High', exact: true }).click();
        await expect(
            page.getByRole('button', { name: 'Edit watchlist priority', exact: true }),
        ).toBeVisible();
        await page.goto('/library?tab=watchlist');
        await page.getByRole('button', { name: 'Edit watchlist priority' }).click();
        await dialog.getByRole('button', { name: 'Remove from watchlist' }).click();
        await expect(
            page
                .getByRole('table', { name: 'Films to watch', exact: true })
                .getByText('Your Watchlist is empty.', { exact: false }),
        ).toBeVisible();
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
