import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

const ROUTE = '/clubs/10000000-0000-4000-8000-000000000031/sessions/past/new';

for (const viewport of screenshotViewports) {
    test(
        `Past Session film search stays anchored and selected films can be changed at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await signInMock(context, `valid-settings-admin-picker-${viewport.name}`);
            await page.setViewportSize(viewport);
            await page.goto(ROUTE, { waitUntil: 'load' });
            const date = page.getByLabel('Date', { exact: true });
            const time = page.getByLabel('Time', { exact: false });
            await expect(date).toBeVisible();
            await expect(time).toBeVisible();
            await settle(page);
            const dateBounds = await date.boundingBox();
            const timeBounds = await time.boundingBox();
            const configuredGap = await date.evaluate((element) =>
                Number.parseFloat(getComputedStyle(element).getPropertyValue('--gap-sm')),
            );
            expect(dateBounds).not.toBeNull();
            expect(timeBounds).not.toBeNull();
            expect(timeBounds!.x - dateBounds!.x - dateBounds!.width).toBeCloseTo(configuredGap, 1);
            expect(dateBounds!.x + dateBounds!.width).toBeLessThanOrEqual(timeBounds!.x);
            const film = page.getByRole('combobox', { name: 'Select a Movie' });
            await film.fill('remembered');
            const results = page.getByRole('listbox', { name: 'Film results' });
            await expect(results).toBeVisible();
            await settle(page);
            const control = await film.boundingBox();
            const dropdown = await results.locator('..').locator('..').boundingBox();
            expect(control).not.toBeNull();
            expect(dropdown).not.toBeNull();
            expect(Math.abs(dropdown!.x - control!.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(dropdown!.width - control!.width)).toBeLessThanOrEqual(1);
            expect(dropdown!.y - control!.y - control!.height).toBeGreaterThanOrEqual(0);
            expect(dropdown!.y - control!.y - control!.height).toBeCloseTo(2);
            await page.getByRole('option', { name: /A remembered film/u }).click();
            const selected = page.getByRole('textbox', { name: 'Select a Movie' });
            await expect(selected).toHaveValue('A remembered film');
            const change = page.getByRole('button', { name: 'Change film' });
            await expect(change).toBeFocused();
            await change.click();
            await expect(selected).toHaveCount(0);
            await expect(film).toBeFocused();
            await expect(film).toHaveValue('');
        },
    );

    test(
        `Past Session steps match ${viewport.name}`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await signInMock(context, `valid-settings-admin-past-${viewport.name}`);
            await page.setViewportSize(viewport);
            await page.goto(ROUTE, { waitUntil: 'load' });
            await settle(page);
            const film = page.getByRole('combobox', { name: 'Select a Movie' });
            await film.fill('remembered');
            await page.getByRole('option', { name: /A remembered film/u }).click();
            await page.getByLabel('Date', { exact: true }).fill('2020-01-01');
            await page.getByLabel('Location').fill('Old cinema');
            await settle(page);
            await expect(page).toHaveScreenshot(`past-session-film-${viewport.name}.png`, {
                fullPage: true,
            });

            await page.getByRole('button', { name: 'Next', exact: true }).click();
            await page.getByRole('checkbox', { name: 'Avery Admin' }).check();
            await page.getByRole('checkbox', { name: 'Morgan Member', exact: true }).check();
            await page
                .getByRole('radiogroup', { name: 'Rating for Avery Admin' })
                .getByRole('radio', { name: '8 of 10', exact: true })
                .click();
            await settle(page);
            await expect(page).toHaveScreenshot(`past-session-attendees-${viewport.name}.png`, {
                fullPage: true,
            });

            await page.getByRole('button', { name: 'Next', exact: true }).click();
            await page.getByRole('combobox', { name: /^Nominated films/u }).fill('remembered');
            await page.getByRole('option', { name: /A remembered rival/u }).click();
            await page
                .getByRole('combobox', {
                    name: 'Selection score for Avery Admin: A remembered film',
                    exact: true,
                })
                .selectOption('0');
            await settle(page);
            await expect(page).toHaveScreenshot(`past-session-nominations-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );
}
