import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

for (const viewport of screenshotViewports) {
    test(
        `Personal archive request, status and private download at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ page, context }) => {
            await page.setViewportSize(viewport);
            await signInMock(context, `valid-archive-success-${viewport.name}`);
            await page.goto('/settings?tab=privacy');
            await settle(page);
            const summary = page
                .locator('summary')
                .filter({ hasText: 'Access, correction and portability' });
            await summary.focus();
            await page.keyboard.press('Enter');
            await expect(
                page.getByRole('link', { name: 'Import or export personal ratings' }),
            ).toBeVisible();
            await expect(
                page.getByRole('link', { name: 'Privacy Notice', exact: true }).first(),
            ).toHaveAttribute('href', '/legal/privacy');
            const archive = page.getByRole('region', { name: 'Personal data archive' });
            await archive.getByRole('button', { name: 'Request archive', exact: true }).click();
            await expect(
                archive.getByRole('button', { name: 'Request archive', exact: true }),
            ).toBeDisabled();
            await expect(archive.getByRole('status')).toContainText('queued');
            await expect(page).toHaveURL(/archive=[0-9a-f-]{36}/u);
            await archive.getByRole('button', { name: 'Refresh status' }).click();
            await expect(archive.getByRole('status')).toContainText('being prepared');
            await archive.getByRole('button', { name: 'Refresh status' }).click();
            await expect(archive.getByRole('status')).toContainText('ready');
            await expect(archive.getByRole('status')).toContainText('25/11/2026');
            await page.reload();
            await expect(archive.getByRole('status')).toContainText('ready');
            const download = page.waitForEvent('download');
            await archive.getByRole('button', { name: 'Download archive' }).click();
            expect((await download).suggestedFilename()).toBe('pickflick-data.json.gz');
            await expect(archive.getByRole('status')).toContainText('Archive downloaded');
            await expect(page.locator('a[href*="signature="]')).toHaveCount(0);
            await settle(page);
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        },
    );
}

test('Archive request preserves its id after an uncertain response and supports offline/status recovery', async ({
    page,
    context,
}) => {
    await signInMock(context, 'valid-archive-request-retry-archive-status-retry');
    await page.goto('/settings?tab=privacy');
    const archive = page.getByRole('region', { name: 'Personal data archive' });
    const request = archive.getByRole('button', { name: 'Request archive', exact: true });
    await request.click();
    await expect(archive.getByRole('status')).toContainText('could not be completed');
    await request.click();
    await expect(archive.getByRole('status')).toContainText('queued');
    await context.setOffline(true);
    await archive.getByRole('button', { name: 'Refresh status' }).click();
    await expect(archive.getByRole('status')).toContainText('offline');
    await context.setOffline(false);
    await archive.getByRole('button', { name: 'Refresh status' }).click();
    await expect(archive.getByRole('status')).toContainText('could not be completed');
    await archive.getByRole('button', { name: 'Refresh status' }).click();
    await expect(archive.getByRole('status')).toContainText('ready');
});

for (const state of ['failed', 'expired']) {
    test(`Archive ${state} state allows a new request`, async ({ page, context }) => {
        await signInMock(context, `valid-archive-${state}`);
        await page.goto('/settings?tab=privacy');
        const archive = page.getByRole('region', { name: 'Personal data archive' });
        await archive.getByRole('button', { name: 'Request archive', exact: true }).click();
        await expect(archive.getByRole('status')).toContainText('queued');
        await archive.getByRole('button', { name: 'Refresh status' }).click();
        await expect(archive.getByRole('status')).toContainText('request another archive');
        await expect(archive.getByRole('button', { name: 'Download archive' })).toHaveCount(0);
        await archive.getByRole('button', { name: 'Request another archive' }).click();
        await expect(archive.getByRole('status')).toContainText('queued');
    });
}

test('Archive controls report denied sessions and unavailable references without private data', async ({
    page,
    context,
}) => {
    await signInMock(context, 'valid-archive-unauthorized');
    await page.goto('/settings?tab=privacy');
    const archive = page.getByRole('region', { name: 'Personal data archive' });
    await archive.getByRole('button', { name: 'Request archive', exact: true }).click();
    await expect(archive.getByRole('status')).toContainText('Your session has ended');
    await signInMock(context, 'valid-archive-outsider');
    await page.goto('/settings?tab=privacy&archive=10000000-0000-4000-8000-000000000031');
    await expect(archive.getByRole('status')).toContainText('unavailable or has expired');
    await expect(archive.getByRole('button', { name: 'Download archive' })).toHaveCount(0);
    await page.goto('/settings?tab=privacy&archive=invalid');
    await expect(archive.getByRole('status')).toContainText('reference is invalid');
});

test('Archive download failure stays in Settings and can be retried', async ({ page, context }) => {
    await signInMock(context, 'valid-archive-download-retry');
    await page.goto('/settings?tab=privacy');
    const archive = page.getByRole('region', { name: 'Personal data archive' });
    await archive.getByRole('button', { name: 'Request archive', exact: true }).click();
    await expect(archive.getByRole('status')).toContainText('queued');
    await archive.getByRole('button', { name: 'Refresh status' }).click();
    await expect(archive.getByRole('status')).toContainText('being prepared');
    await archive.getByRole('button', { name: 'Refresh status' }).click();
    await expect(archive.getByRole('status')).toContainText('ready');
    await archive.getByRole('button', { name: 'Download archive' }).click();
    await expect(archive.getByRole('status')).toContainText('could not be downloaded');
    await expect(page).toHaveURL(/\/settings\?/u);
    const download = page.waitForEvent('download');
    await archive.getByRole('button', { name: 'Download archive' }).click();
    expect((await download).suggestedFilename()).toBe('pickflick-data.json.gz');
});
