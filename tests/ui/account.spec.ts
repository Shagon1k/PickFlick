import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

for (const viewport of screenshotViewports) {
    test(`Settings profile at ${viewport.name}`, { tag: '@visual' }, async ({ page, context }) => {
        await page.setViewportSize(viewport);
        await signInMock(context, `valid-account-profile-${viewport.name}`);
        await page.goto('/settings', { waitUntil: 'load' });
        await expect(page.getByLabel('Display name')).toHaveValue('Jane Doe');
        await settle(page);
        await expectNoPageOverflow(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await expect(page).toHaveScreenshot(`settings-profile-${viewport.name}.png`, {
            fullPage: true,
        });
    });

    test(
        `Settings appearance at ${viewport.name}`,
        { tag: '@visual' },
        async ({ page, context }) => {
            await page.setViewportSize(viewport);
            await signInMock(context, `valid-account-appearance-${viewport.name}`);
            await page.goto('/settings?tab=appearance', { waitUntil: 'load' });
            await expect(page.getByRole('button', { name: 'Save appearance' })).toBeEnabled();
            await settle(page);
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await expect(page).toHaveScreenshot(`settings-appearance-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );
}

test(
    'Profile saves, validates and removes a private photo',
    { tag: '@smoke' },
    async ({ page, context }) => {
        await signInMock(context, `valid-account-edit-${Date.now()}`);
        await page.goto('/settings');
        await page.getByLabel('Display name').fill('   ');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByLabel('Display name')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.getByLabel('Display name')).toBeFocused();
        await page.getByLabel('Display name').fill('Changed name');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Display name')).toHaveValue('Changed name');
        await page.getByLabel('Change photo').setInputFiles({
            name: 'photo.png',
            mimeType: 'image/png',
            buffer: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                'base64',
            ),
        });
        await expect(page.getByRole('status').filter({ hasText: 'Photo saved.' })).toBeVisible();
        await page.getByRole('button', { name: 'Remove photo' }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Photo removed.' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Remove photo' })).toBeDisabled();
        await page.getByLabel('Display name').fill('W'.repeat(80));
        await expect(page.getByRole('status').filter({ hasText: 'Photo removed.' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible();
        await settle(page);
        await expectNoPageOverflow(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await expectNoPageOverflow(page);
    },
);

test(
    'Appearance persists and configures all film tables without hiding essential actions',
    { tag: '@smoke' },
    async ({ page, context }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await signInMock(context, `valid-hub-library-appearance-${Date.now()}`);
        await page.goto('/settings?tab=appearance');
        await page.getByText('Color reveal', { exact: true }).click();
        await page.getByText('Black-and-white posters and trailers', { exact: true }).click();
        await page.getByText('Quiet mode', { exact: true }).click();
        await page.getByRole('combobox', { name: 'List spacing' }).click();
        await page.getByRole('option', { name: 'Compact', exact: true }).click();
        await page.getByRole('button', { name: 'Save appearance' }).click();
        await expect(
            page.getByRole('status').filter({ hasText: 'Appearance saved.' }),
        ).toBeVisible();
        await page.reload();
        await expect(
            page.getByRole('switch', { name: 'Color reveal', exact: true }),
        ).not.toBeChecked();
        await expect(page.locator('html')).toHaveAttribute('data-quiet-mode', 'true');
        await page.route('**/api/movies/images/**', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: Buffer.from(
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                    'base64',
                ),
            }),
        );
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/movies/10000000-0000-4000-8000-000000000037');
        const poster = page.locator('[data-film-media]').filter({ visible: true }).first();
        await expect(poster).toHaveCSS('filter', 'grayscale(1)');
        const posterSurface = poster.locator('xpath=ancestor::*[@data-fill][1]');
        await poster.locator('xpath=ancestor::*[@data-color-reveal-trigger][1]').hover();
        await expect(posterSurface.locator('[data-color-reveal-layer]')).toHaveCSS(
            'mask-image',
            'none',
        );
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(posterSurface.locator('[data-color-reveal-layer]')).toHaveCSS(
            'transition-duration',
            '0s',
        );
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/library?sort=year&direction=asc');
        await page.getByText('Table columns', { exact: true }).click();
        await page.getByRole('switch', { name: 'Year', exact: true }).focus();
        await page.keyboard.press('Space');
        await expect(page.getByRole('columnheader', { name: /^Year/u })).toHaveCount(0);
        await expect(page.getByRole('columnheader', { name: /^Film/u })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /^Rating/u })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Film.*reset sorting$/u })).toBeVisible();
        await page.getByRole('switch', { name: 'Rank', exact: true }).focus();
        await page.keyboard.press('Space');
        await expect(page.getByRole('columnheader', { name: '#', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: /^Film.*reset sorting$/u }).click();
        await expect(page).toHaveURL(/sort=default/u);
        await page.getByRole('columnheader', { name: /^Film/u }).getByRole('button').click();
        await expect(page).toHaveURL(/sort=title/u);
        await page.reload();
        await expect(page.getByRole('columnheader', { name: /^Year/u })).toHaveCount(0);
        await page.goto('/clubs/10000000-0000-4000-8000-000000000031/ratings');
        await expect(page.getByRole('columnheader', { name: /^Year/u })).toHaveCount(0);
        await expect(page.getByRole('columnheader', { name: /^Rating/u })).toBeVisible();
        await page.getByText('Table columns', { exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('switch', { name: 'Genre', exact: true }).focus();
        await page.keyboard.press('Space');
        await expect(page.getByRole('columnheader', { name: /^Genre/u })).toHaveCount(0);
        await expect(page.getByRole('switch', { name: 'Genre', exact: true })).toBeFocused();
        await page.goto('/library?tab=watchlist');
        await expect(page.getByRole('columnheader', { name: /^Year/u })).toHaveCount(0);
        await expect(page.getByRole('columnheader', { name: /^Priority/u })).toBeVisible();
        await expectNoPageOverflow(page);
        await signInMock(context, `valid-library-another-${Date.now()}`);
        await page.reload();
        await expect(page.getByRole('columnheader', { name: /^Year/u })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-quiet-mode', 'false');
    },
);

test('Settings keeps unsaved entries on failure and reports offline saves', async ({
    page,
    context,
}) => {
    await signInMock(context, `valid-account-save-failure-${Date.now()}`);
    await page.goto('/settings');
    await page.getByLabel('Display name').fill('Unsaved name');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Your changes could not be saved.' }),
    ).toBeVisible();
    await expect(page.getByLabel('Display name')).toHaveValue('Unsaved name');
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: /offline/iu })).toBeVisible();
});

test('Settings protects unauthenticated entry and shows a retry after an API failure', async ({
    page,
    context,
}) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login\?returnTo=/u);
    await signInMock(context, 'valid-account-unavailable');
    await page.goto('/settings');
    await expect(page.getByRole('region', { name: 'Settings unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: /try again|retry/iu })).toBeVisible();
});

test('Settings announces loading before the profile is ready', async ({ page, context }) => {
    await signInMock(context, 'valid-account-loading');
    await page.goto('/settings', { waitUntil: 'commit' });
    await expect(page.getByRole('status').filter({ hasText: 'Loading Settings…' })).toBeVisible();
    await expect(page.getByLabel('Display name')).toHaveValue('Jane Doe');
});
