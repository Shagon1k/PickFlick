import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { settle } from './settle';

async function openNotifications(page: Page, token: string, width = 1440) {
    await page.setViewportSize({ width, height: 900 });
    await page
        .context()
        .addCookies([
            { name: 'pickflick.session_token', value: token, url: 'http://127.0.0.1:41730' },
        ]);
    await page.goto('/app', { waitUntil: 'load' });
    const trigger =
        width < 1024
            ? page.getByRole('button', { name: /Alerts/u })
            : page.getByRole('button', { name: /^Notifications/u });
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Notifications' });
    await expect(panel).toBeVisible();
    return { trigger, panel };
}

for (const width of [390, 1440]) {
    test(
        `notification read state, focus and dismissal at ${width}`,
        { tag: '@smoke' },
        async ({ page }) => {
            const { trigger, panel } = await openNotifications(
                page,
                `valid-notifications-behavior-${width}`,
                width,
            );
            await expect(panel.getByText('3 unread', { exact: true })).toBeVisible();
            await expect(panel).toBeFocused();
            // An update without a destination is marked read by activating its row.
            await panel
                .getByRole('button', { name: /^This update is no longer available\./u })
                .focus();
            await page.keyboard.press('Enter');
            await expect(panel.getByText('2 unread', { exact: true })).toBeVisible();
            await expect(panel).toBeFocused();
            await page.keyboard.press('Shift+Tab');
            await expect(panel.getByRole('button', { name: 'Load more' })).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(panel.getByRole('button', { name: 'Mark all as read' })).toBeFocused();
            await panel.getByRole('button', { name: 'Load more' }).click();
            await expect(panel.getByRole('listitem')).toHaveCount(23);
            await expect(panel).toBeFocused();
            await expect(panel.getByRole('button', { name: 'Load more' })).toHaveCount(0);
            await panel.getByRole('button', { name: 'Mark all as read' }).click();
            await expect(panel.getByText('You’re all caught up')).toBeVisible();
            await expect(panel).toBeFocused();
            await expect(panel.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
            await expect(panel.getByText('This update is no longer available.')).toBeVisible();
            expect(
                (
                    await new AxeBuilder({ page })
                        .include(`#${await panel.getAttribute('id')}`)
                        .analyze()
                ).violations,
            ).toEqual([]);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.keyboard.press('Escape');
            await expect(panel).toBeHidden();
            await expect(trigger).toBeFocused();
            await trigger.click();
            await page.getByRole('banner').click({ position: { x: 5, y: 5 } });
            await expect(panel).toBeHidden();
            await expect(page).toHaveURL('/app');
        },
    );

    test(`notifications populated at ${width}`, { tag: '@visual' }, async ({ page }) => {
        const { panel } = await openNotifications(
            page,
            `valid-notifications-visual-${width}`,
            width,
        );
        await expect(panel.getByText('3 unread', { exact: true })).toBeVisible();
        await settle(page);
        await expect(page).toHaveScreenshot(`notifications-${width}.png`, { fullPage: true });
    });
}

test('notifications synchronize across tabs', async ({ page, context }) => {
    const token = 'valid-notifications-two-tabs';
    const { panel } = await openNotifications(page, token);
    const other = await context.newPage();
    const { panel: otherPanel } = await openNotifications(other, token);
    await expect(otherPanel.getByText('3 unread', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(otherPanel.getByText('You’re all caught up')).toBeVisible();
    await other.close();
});

test('notifications reconcile authoritative state after an offline stream gap', async ({
    page,
    context,
}) => {
    const { panel } = await openNotifications(page, 'valid-notifications-gap');
    await expect(panel.getByText('3 unread', { exact: true })).toBeVisible();
    await context.setOffline(true);
    await panel.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(panel.getByRole('alert')).toContainText('You appear to be offline.');
    const response = await context.request.post('/api/notifications/read', { data: {} });
    expect(response.status()).toBe(204);
    await context.setOffline(false);
    await expect(panel.getByText('You’re all caught up')).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
});

test('notifications show an empty inbox without enabling a read action', async ({ page }) => {
    const { panel } = await openNotifications(page, 'valid-empty-inbox');
    await expect(panel.getByText('No notifications yet.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
});

test('notifications discard a cached inbox when the session ends', async ({ page }) => {
    const { panel } = await openNotifications(page, 'valid-notifications-expired-session');
    await expect(panel.getByText('3 unread', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(panel.getByRole('alert')).toContainText('Your session has ended. Sign in again.');
    await expect(panel.getByRole('listitem')).toHaveCount(0);
    await expect(panel.getByRole('link')).toHaveCount(0);
});

test('notifications recover when the browser loses an action request', async ({ page }) => {
    const { panel } = await openNotifications(page, 'valid-notifications-transport-failure');
    await expect(panel.getByText('3 unread', { exact: true })).toBeVisible();
    await page.route('**/app', (route) => route.abort());
    await panel.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(panel.getByRole('alert')).toContainText('Read state could not be saved.');
    await expect(panel.getByRole('button', { name: 'Mark all as read' })).toBeEnabled();
    await page.unroute('**/app');
    await panel.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(panel.getByText('You’re all caught up')).toBeVisible();
});

test('notifications show loading, load failures, retries and save failures', async ({ page }) => {
    const { panel: loading } = await openNotifications(page, 'valid-notifications-loading');
    await expect(loading.getByText('Loading notifications…')).toBeVisible();
    await expect(loading.getByText('3 unread', { exact: true })).toBeVisible();
    const { panel: error } = await openNotifications(page, 'valid-notifications-load-error');
    await expect(error.getByRole('alert')).toContainText('Notifications could not be loaded.');
    await error.getByRole('button', { name: 'Try again' }).click();
    await expect(error.getByText('3 unread', { exact: true })).toBeVisible();
    const { panel: save } = await openNotifications(page, 'valid-notifications-save-error');
    await save.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(save.getByRole('alert')).toContainText('Read state could not be saved.');
    await expect(save.getByText('3 unread', { exact: true })).toBeVisible();
});

for (const width of [390, 1440]) {
    test(
        `notification navigation dismisses the persistent Club overlay at ${width}`,
        { tag: '@smoke' },
        async ({ page }) => {
            await openNotifications(page, `valid-hub-notifications-navigation-${width}`, width);
            await page.goto('/clubs/10000000-0000-4000-8000-000000000031/sessions');
            const trigger = page.getByRole('button', {
                name: width < 1024 ? /Alerts/u : /^Notifications/u,
            });
            await trigger.click();
            const panel = page.getByRole('dialog', { name: 'Notifications' });
            const link = panel.getByRole('link').first();
            await expect(link).toHaveAttribute(
                'href',
                '/clubs/10000000-0000-4000-8000-000000000031/achievements',
            );
            await link.focus();
            await page.keyboard.press('Enter');
            await expect(page).toHaveURL(
                '/clubs/10000000-0000-4000-8000-000000000031/achievements',
            );
            await expect(panel).toBeHidden();
            await expect(trigger).toHaveAttribute('aria-expanded', 'false');
            await page.keyboard.press('Tab');
            expect(
                await page.evaluate(
                    () => document.activeElement?.closest('[role="dialog"]') === null,
                ),
            ).toBe(true);
        },
    );
}

test('notification heartbeats do not request inbox state', { tag: '@smoke' }, async ({ page }) => {
    await page.clock.install();
    const { panel } = await openNotifications(page, 'valid-notifications-heartbeat');
    await expect(panel.getByText('3 unread', { exact: true })).toBeVisible();
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.method() === 'POST') requests.push(request.url());
    });
    await page.clock.fastForward(4 * 60_000);
    await expect(panel.getByText('3 unread', { exact: true })).toBeVisible();
    expect(requests).toEqual([]);
    await page.clock.fastForward(60_000);
    await expect.poll(() => requests.length).toBe(1);
});

test('notifications reconcile a change received during an earlier inbox request', async ({
    page,
    context,
}) => {
    const { panel } = await openNotifications(page, 'valid-notifications-loading-overlap');
    await expect(panel.getByText('Loading notifications…')).toBeVisible();
    const response = await context.request.post('/api/notifications/read', { data: {} });
    expect(response.status()).toBe(204);
    await expect(panel.getByText('You’re all caught up')).toBeVisible();
});
