import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { captureSocialSignIn, signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

for (const viewport of screenshotViewports) {
    test(
        `Account deletion confirmation and access-ended state at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ page, context }) => {
            await page.setViewportSize(viewport);
            await signInMock(context, `valid-deletion-success-${viewport.name}`);
            await page.goto('/settings?tab=privacy', { waitUntil: 'load' });
            const readSignIn = await captureSocialSignIn(page);
            await page.getByRole('button', { name: 'Sign in again with Google' }).click();
            await expect.poll(readSignIn).toMatchObject({
                provider: 'google',
                callbackURL: '/settings?tab=privacy&deletion=confirm',
                additionalParams: { prompt: 'select_account' },
            });
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await page.goto('/settings?tab=privacy&deletion=confirm', { waitUntil: 'load' });
            await page.getByRole('button', { name: 'Delete account', exact: true }).click();
            const dialog = page.getByRole('dialog', { name: 'Permanently delete your account?' });
            await expect(dialog).toBeVisible();
            await expect(dialog).toContainText('Text inside comments is preserved.');
            await expect(dialog).toContainText('jane.doe@example.invalid');
            await expect(
                dialog.getByRole('button', { name: 'Delete account', exact: true }),
            ).toBeDisabled();
            await dialog.getByLabel('Type DELETE to confirm').fill('delete');
            await expect(
                dialog.getByRole('button', { name: 'Delete account', exact: true }),
            ).toBeDisabled();
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
            await expect(dialog).toHaveCount(0);
            await expect(
                page.getByRole('button', { name: 'Delete account', exact: true }),
            ).toBeFocused();
            await page.getByRole('button', { name: 'Delete account', exact: true }).click();
            await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
            await settle(page);
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await dialog.getByLabel('Type DELETE to confirm').press('Enter');
            await expect(page).toHaveURL(/\/login\?account=deleted$/u);
            await expect(
                page.getByRole('status').filter({ hasText: 'Account deletion accepted.' }),
            ).toContainText('Access has ended');
        },
    );

    test(
        `Account deletion privacy panel at ${viewport.name}`,
        { tag: '@visual' },
        async ({ page, context }) => {
            await page.setViewportSize(viewport);
            await signInMock(context, `valid-deletion-visual-${viewport.name}`);
            await page.goto('/settings?tab=privacy', { waitUntil: 'load' });
            await settle(page);
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await expect(page).toHaveScreenshot(`settings-deletion-${viewport.name}.png`, {
                fullPage: true,
            });
            await page.goto('/settings?tab=privacy&deletion=confirm', { waitUntil: 'load' });
            await page.getByRole('button', { name: 'Delete account', exact: true }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await settle(page);
            await expect(page.getByRole('dialog')).toHaveScreenshot(
                `settings-deletion-confirm-${viewport.name}.png`,
            );
        },
    );
}

test('Deletion keeps confirmation through errors and explains expired reauthentication', async ({
    page,
    context,
}) => {
    await signInMock(context, 'valid-deletion-stale');
    await page.goto('/settings?tab=privacy&deletion=confirm');
    await page.getByRole('button', { name: 'Delete account', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
    await dialog.getByRole('button', { name: 'Delete account', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText(
        'Sign in again to the same account before confirming deletion.',
    );
    await expect(dialog.getByLabel('Type DELETE to confirm')).toHaveValue('DELETE');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});

test('Deletion gives offline feedback and leaves the dialog open', async ({ page, context }) => {
    await signInMock(context, 'valid-deletion-offline');
    await page.goto('/settings?tab=privacy&deletion=confirm');
    await page.getByRole('button', { name: 'Delete account', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
    await context.setOffline(true);
    await dialog.getByRole('button', { name: 'Delete account', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText(/offline/u);
    await context.setOffline(false);
});
