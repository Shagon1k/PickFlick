import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

const clubId = '10000000-0000-4000-8000-000000000031';
async function authenticate(context: BrowserContext, token: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: token,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

test(
    'Members removal confirms intent, preserves feedback, and returns focus after the row disappears',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, `valid-members-remove-${test.info().repeatEachIndex}`);
        await page.goto(`/clubs/${clubId}/members`);
        const trigger = page.getByRole('button', { name: 'Remove Morgan Member' });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Remove this member?' });
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await trigger.click();
        await dialog.getByRole('textbox', { name: 'Type REMOVE to confirm' }).fill('wrong');
        await dialog.getByRole('button', { name: 'Confirm removal' }).click();
        await expect(dialog.getByRole('status')).toContainText('confirmation did not match');
        await dialog.getByRole('textbox', { name: 'Type REMOVE to confirm' }).fill('REMOVE');
        await dialog.getByRole('button', { name: 'Confirm removal' }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText('Morgan Member')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeFocused();
        await expect(page.getByRole('status')).toContainText('Shared history is preserved');
    },
);

test('Member and restricted Club views explain unavailable actions without losing the roster', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-members-member');
    await page.goto(`/clubs/${clubId}/members`);
    await expect(page.getByRole('button', { name: /remove/iu })).toHaveCount(0);
    await expect(page.getByText('Morgan Member')).toBeVisible();
    await authenticate(context, 'valid-members-adminless');
    await page.goto(`/clubs/${clubId}/members`);
    await expect(page.getByRole('region', { name: 'Club status' })).toContainText('no Admin');
    await expect(page.getByRole('link', { name: 'Invite members' })).toHaveCount(0);
    await page.goto(`/clubs/${clubId}/settings`);
    await expect(page.getByRole('button', { name: 'Create invitation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Manage Moderators' })).toHaveCount(0);
    await authenticate(context, 'valid-members-over-limit');
    await page.goto(`/clubs/${clubId}/members`);
    await expect(page.getByRole('region', { name: 'Club status' })).toContainText(
        'over its member limit',
    );
    await expect(page.getByRole('button', { name: 'Remove Morgan Member' })).toBeVisible();
    await authenticate(context, 'valid-members-archived');
    await page.goto(`/clubs/${clubId}/members`);
    await expect(page.getByRole('button', { name: /remove/iu })).toHaveCount(0);
});

test(
    'pending invitation popover supports keyboard focus, decline, and acceptance into the authorized Club',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-pending-decline');
        await page.goto('/app');
        const trigger = page.getByRole('button', { name: 'Open pending invites' });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Pending invites' });
        await expect(dialog.getByRole('heading', { name: 'Saturday Matinee Club' })).toBeVisible();
        await expect(dialog).toHaveAttribute(
            'id',
            (await trigger.getAttribute('aria-controls')) ?? '',
        );
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await trigger.click();
        await dialog.getByRole('button', { name: 'Decline' }).click();
        await expect(dialog.getByRole('status')).toContainText('Invitation declined');
        await expect(dialog.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await authenticate(context, 'valid-pending-accept');
        await page.goto('/app');
        await trigger.click();
        await dialog.getByRole('button', { name: 'Accept', exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/clubs/${clubId}$`, 'u'));
        await expect(page.getByRole('heading', { name: 'Midnight Society' })).toBeVisible();
    },
);

for (const viewport of screenshotViewports) {
    test(`keyboard decline preserves dialog focus and Escape dismissal at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await authenticate(
            context,
            `valid-pending-focus-${viewport.name}-${test.info().repeatEachIndex}-${test.info().retry}`,
        );
        await page.setViewportSize(viewport);
        await page.goto('/app');
        const trigger = page.getByRole('button', { name: 'Open pending invites' });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Pending invites' });
        const decline = dialog.getByRole('button', { name: 'Decline', exact: true });
        const close = dialog.getByRole('button', { name: 'Close', exact: true });
        await expect(decline).toBeEnabled();
        await expect(close).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(decline).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(dialog.getByRole('status')).toContainText('Invitation declined');
        await expect(decline).toHaveCount(0);
        await expect(close).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(close).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(close).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
    });
}

test('Moderator management remains accessible and keeps keyboard focus inside its dialog', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-settings-admin-moderation');
    await page.goto(`/clubs/${clubId}/settings`);
    const trigger = page.getByRole('button', { name: 'Manage Moderators' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Manage Moderators' });
    await expect(dialog).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (let index = 0; index < 8; index++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
            true,
        );
    }
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
});

test('invite and notification overlays close each other and keep keyboard focus in the active popover', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-hub-pending-overlays');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/clubs/${clubId}/members`);
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open pending invites' }).click();
    await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toHaveCount(0);
    const dialog = page.getByRole('dialog', { name: 'Pending invites' });
    await expect(dialog.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
    for (let index = 0; index < 6; index++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
            true,
        );
    }
});

test('pending invitations show recoverable loading failures and an explicit empty state', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-pending-error');
    await page.goto('/app');
    await page.getByRole('button', { name: 'Open pending invites' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pending invites' });
    await expect(dialog.getByRole('status')).toContainText('could not be loaded');
    await expect(dialog.getByRole('button', { name: 'Retry invites' })).toBeVisible();
    await authenticate(context, 'valid-empty-invites');
    await page.goto('/app');
    await page.getByRole('button', { name: 'Open pending invites' }).click();
    await expect(dialog.getByRole('status')).toContainText('No pending Club invitations');
});

test('member management and invite popovers meet touch, focus, accessibility, and responsive contracts', async ({
    browser,
}) => {
    test.slow();
    const context = await browser.newContext({ hasTouch: true, isMobile: true });
    try {
        await authenticate(context, 'valid-hub-pending-responsive');
        const page = await context.newPage();
        for (const viewport of [...canonicalViewports, ...gapViewports]) {
            await page.setViewportSize(viewport);
            await page.goto(`/clubs/${clubId}/members`, { waitUntil: 'load' });
            await settle(page);
            await page.getByRole('button', { name: 'Open pending invites' }).tap();
            const dialog = page.getByRole('dialog', { name: 'Pending invites' });
            await expect(dialog.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
            await settle(page);
            const widths = await page.evaluate(() => ({
                body: document.body.scrollWidth,
                document: document.documentElement.scrollWidth,
                client: document.documentElement.clientWidth,
            }));
            expect(widths.body).toBeLessThanOrEqual(widths.client);
            expect(widths.document).toBeLessThanOrEqual(widths.client);
            const box = await dialog.boundingBox();
            expect(box?.x).toBeGreaterThanOrEqual(0);
            expect(box?.y).toBeGreaterThanOrEqual(0);
            expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
            expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            expect(
                (await dialog.getByRole('button', { name: 'Accept', exact: true }).boundingBox())
                    ?.height,
            ).toBeGreaterThanOrEqual(44);
            await dialog.getByRole('button', { name: 'Close', exact: true }).tap();
            await page.getByRole('button', { name: 'Remove Morgan Member' }).tap();
            await expect(page.getByRole('dialog', { name: 'Remove this member?' })).toBeVisible();
            await settle(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.keyboard.press('Escape');
        }
    } finally {
        await context.close();
    }
});

for (const viewport of screenshotViewports) {
    for (const state of ['admin', 'member', 'adminless', 'over-limit']) {
        test(
            `Club members ${state} matches ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await authenticate(context, `valid-members-${state}-visual-${viewport.name}`);
                await page.setViewportSize(viewport);
                await page.goto(`/clubs/${clubId}/members`, { waitUntil: 'load' });
                await settle(page);
                await expect(page).toHaveScreenshot(`club-members-${state}-${viewport.name}.png`, {
                    fullPage: true,
                });
            },
        );
    }

    test(
        `pending invite popover matches ${viewport.name}`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-hub-pending-visual-${viewport.name}`);
            await page.setViewportSize(viewport);
            await page.goto(`/clubs/${clubId}`, { waitUntil: 'load' });
            await settle(page);
            await page.getByRole('button', { name: 'Open pending invites' }).click();
            await expect(
                page
                    .getByRole('dialog', { name: 'Pending invites' })
                    .getByRole('button', { name: 'Accept', exact: true }),
            ).toBeVisible();
            await expect(page).toHaveScreenshot(`pending-invites-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );
}
