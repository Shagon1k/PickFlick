import AxeBuilder from '@axe-core/playwright';
import { RATINGS_CSV_HEADER, RATINGS_CSV_MAX_BYTES } from '@pickflick/contracts';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { holdRoute, settle } from './settle';
import { screenshotViewports } from './viewports';

const MOVIE_ID = '10000000-0000-4000-8000-000000000001';
const CSV = `${RATINGS_CSV_HEADER}\r\n1,${MOVIE_ID},Descriptive name,8\r\n`;
const csvFile = (csv = CSV) => ({
    name: 'ratings.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
});

for (const viewport of screenshotViewports) {
    test(
        `Ratings CSV preview and confirmation at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ page, context }) => {
            await page.setViewportSize(viewport);
            await signInMock(context, `valid-csv-flow-${viewport.name}`);
            await page.goto('/settings?tab=import-export');
            const preview = page.getByRole('button', { name: 'Preview import' });
            await expect(preview).toBeDisabled();
            await page.getByLabel('Ratings CSV file').setInputFiles(csvFile());
            await preview.click();
            await expect(
                page.getByRole('status').filter({ hasText: 'Validation complete.' }),
            ).toContainText('1 new');
            await page.getByText('Review 1 valid rating').click();
            await expect(page.getByRole('table', { name: 'Ratings import preview' })).toContainText(
                'Film, "One"',
            );
            const hasLocalOverflow = await page
                .getByRole('region', { name: 'Ratings import preview scroll region' })
                .evaluate((element) => element.scrollWidth > element.clientWidth);
            expect(hasLocalOverflow).toBe(viewport.width < 768);
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.getByRole('button', { name: 'Cancel', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Confirm import' })).toHaveCount(0);
            await preview.click();
            await page.getByRole('button', { name: 'Confirm import' }).click();
            await expect(
                page.getByRole('status').filter({ hasText: 'Import complete.' }),
            ).toBeVisible();
            await preview.click();
            await expect(
                page.getByRole('status').filter({ hasText: 'Validation complete.' }),
            ).toContainText('1 unchanged');
            await page
                .getByLabel('Ratings CSV file')
                .setInputFiles(csvFile(`${CSV}1,invalid,Film,12\n1,${MOVIE_ID},Duplicate,6`));
            await expect(page.getByRole('button', { name: 'Confirm import' })).toHaveCount(0);
            await preview.click();
            await expect(page.getByLabel('CSV errors').getByRole('listitem')).toHaveCount(2);
            await expect(
                page.getByRole('status').filter({ hasText: 'Nothing imported.' }),
            ).toBeVisible();
            await expect(page.getByRole('button', { name: 'Confirm import' })).toHaveCount(0);
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Export ratings', exact: true }).click();
            expect((await downloadPromise).suggestedFilename()).toBe('pickflick-ratings-v1.csv');
            await expect(
                page.getByRole('status').filter({ hasText: 'Exported 1 rating.' }),
            ).toBeVisible();
            await signInMock(context, `valid-csv-empty-${viewport.name}`);
            await page.reload();
            const emptyDownload = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Export ratings', exact: true }).click();
            await emptyDownload;
            await expect(
                page.getByRole('status').filter({ hasText: 'no personal ratings' }),
            ).toBeVisible();
        },
    );

    test(
        `Settings import export at ${viewport.name}`,
        { tag: '@visual' },
        async ({ page, context }) => {
            await page.setViewportSize(viewport);
            await signInMock(context, `valid-csv-visual-${viewport.name}`);
            await page.goto('/settings?tab=import-export', { waitUntil: 'load' });
            await expect(
                page.getByRole('button', { name: 'Export ratings', exact: true }),
            ).toBeEnabled();
            await settle(page);
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await expect(page).toHaveScreenshot(`settings-import-export-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );
}

test('CSV handles size, offline, unavailable and interrupted requests with recoverable feedback', async ({
    page,
    context,
}) => {
    await signInMock(context, 'valid-csv-failure');
    await page.goto('/settings?tab=import-export');
    await page
        .getByLabel('Ratings CSV file')
        .setInputFiles(csvFile('x'.repeat(RATINGS_CSV_MAX_BYTES + 1)));
    await expect(page.getByRole('status').filter({ hasText: 'exceeds 512 KiB' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview import' })).toBeDisabled();
    await page.getByLabel('Ratings CSV file').setInputFiles(csvFile());
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Preview import' }).click();
    await expect(page.getByRole('status').filter({ hasText: /offline/iu })).toBeVisible();
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Preview import' }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Ratings could not be transferred.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Export ratings', exact: true }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Ratings could not be transferred.' }),
    ).toHaveCount(2);
    await page.route('**/settings?tab=import-export', async (route) => {
        if (route.request().headers()['next-action']) await route.abort();
        else await route.continue();
    });
    await page.getByRole('button', { name: 'Preview import' }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'connection was interrupted' }),
    ).toBeVisible();
});

test('CSV keyboard selection and pending controls preserve the selected file; expired sessions deny import', async ({
    page,
    context,
}) => {
    await signInMock(context, 'valid-csv-pending');
    await page.goto('/settings?tab=import-export');
    const choose = page.getByRole('button', { name: 'Choose file', exact: true });
    await choose.focus();
    const chooserPromise = page.waitForEvent('filechooser');
    await choose.press('Enter');
    await (await chooserPromise).setFiles(csvFile());
    const release = await holdRoute(page, '**/settings?tab=import-export', (request) =>
        Boolean(request.headers()['next-action']),
    );
    const preview = page.getByRole('button', { name: 'Preview import' });
    await preview.click();
    await expect(preview).toHaveAttribute('aria-busy', 'true');
    await expect(choose).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Export ratings', exact: true })).toBeDisabled();
    release();
    await expect(
        page.getByRole('status').filter({ hasText: 'Validation complete.' }),
    ).toBeVisible();
    await signInMock(context, 'valid-csv-expired');
    await page.getByRole('button', { name: 'Confirm import' }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Your session has ended. Sign in again.' }),
    ).toBeVisible();
    await expect(choose).toBeEnabled();
    await expect(page.getByText('ratings.csv', { exact: true })).toBeVisible();
});
