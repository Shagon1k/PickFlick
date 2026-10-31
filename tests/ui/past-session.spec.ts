import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

const ROUTE = '/clubs/10000000-0000-4000-8000-000000000031/sessions/past/new';

for (const viewport of screenshotViewports) {
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
            await page.getByRole('combobox', { name: 'Add nominated Movies' }).fill('remembered');
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
