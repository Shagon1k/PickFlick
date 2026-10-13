import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { seedFixture } from './backend-fixture';
import { settle } from './settle';
import { canonicalViewports } from './viewports';

test(
    'Session creation, editing, cancellation and persisted Hub projection',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const fixture = await seedFixture(context);
        await page.goto(`/clubs/${fixture.clubId}/sessions/new`);
        await page.getByLabel('Date').fill('2026-12-01');
        await page.getByLabel('Location').fill('Room A');
        await page.getByLabel('Topic').fill('Noir night');
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await expect(page.getByText('Session created. Nomination is open.')).toBeVisible();
        await page.getByRole('link', { name: 'Open Session' }).click();
        await expect(page.getByRole('heading', { name: 'Noir night', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Edit Session' }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Edit Session' })).toBeFocused();
        await page.getByRole('button', { name: 'Edit Session' }).click();
        await page.getByRole('dialog').getByLabel('Location').fill('Room B');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.reload();
        await expect(page.getByText('Room B', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel Session', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled();
        await page.getByLabel('Type CANCEL to confirm').fill('CANCEL');
        await page.getByRole('button', { name: 'Confirm cancellation' }).click();
        await expect(
            page.getByText('This Session was cancelled. Its history is preserved.'),
        ).toBeVisible();
        await page.goto(`/clubs/${fixture.clubId}`);
        await expect(page.getByRole('link', { name: 'Create Session', exact: true })).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'Noir night', exact: true }).first(),
        ).toBeVisible();
    },
);

test(
    'Pre-selected Movie uses shared keyboard search and enters Watching',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const fixture = await seedFixture(context);
        await page.goto(`/clubs/${fixture.clubId}/sessions/new`);
        await page.getByLabel('Date').fill('2026-12-01');
        await page.getByLabel('Location').fill('Room A');
        await page.getByRole('radio', { name: 'Pre-selected Movie' }).check();
        const search = page.getByRole('combobox', { name: 'Select a Movie' });
        await search.fill('film');
        await expect(page.getByRole('option')).toHaveCount(1);
        await search.press('ArrowDown');
        await search.press('Enter');
        await expect(search).toHaveValue('Synthetic Movie');
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await page.getByRole('link', { name: 'Open Session' }).click();
        await expect(page.getByText('watching', { exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'View selected Movie' }).click();
        await expect(
            page.getByRole('heading', { name: 'Synthetic Movie', exact: true }),
        ).toBeVisible();
    },
);

for (const viewport of canonicalViewports) {
    test(`Create Session and typed confirmation accessibility at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        const fixture = await seedFixture(context, true);
        await page.setViewportSize(viewport);
        await page.goto(`/sessions/${fixture.sessionId}`);
        await settle(page);
        await page.getByRole('button', { name: 'Cancel Session', exact: true }).click();
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(
            page.getByRole('button', { name: 'Cancel Session', exact: true }),
        ).toBeFocused();
        const width = await page.evaluate(() => ({
            body: document.body.scrollWidth,
            client: document.documentElement.clientWidth,
        }));
        expect(width.body).toBeLessThanOrEqual(width.client);
    });
}
