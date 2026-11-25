import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

for (const viewport of screenshotViewports) {
    test(
        `Subscription composition and keyboard at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ page, context }) => {
            await page.setViewportSize(viewport);
            await signInMock(context, `valid-billing-free-layout-${viewport.name}`);
            await page.goto('/settings?tab=subscription', { waitUntil: 'load' });
            await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
            await settle(page);
            await expect(page.getByText('No billing history', { exact: true })).toBeVisible();
            await expectNoPageOverflow(page);
            const upgrade = page.getByRole('button', { name: 'Upgrade to Pro', exact: true });
            await upgrade.focus();
            await expect(upgrade).toBeFocused();
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page
                .getByRole('progressbar', { name: 'Administered Clubs' })
                .scrollIntoViewIfNeeded();
            await expect(
                page.getByRole('progressbar', { name: 'Administered Clubs' }),
            ).toHaveAttribute('value', '1');
        },
    );

    for (const plan of ['free', 'pro']) {
        test(
            `Subscription ${plan} at ${viewport.name}`,
            { tag: '@visual' },
            async ({ page, context }) => {
                await page.setViewportSize(viewport);
                await signInMock(context, `valid-billing-${plan}-visual-${viewport.name}`);
                await page.goto('/settings?tab=subscription', { waitUntil: 'load' });
                await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
                await expect(page.getByText(/Loading billing history/)).toHaveCount(0);
                await settle(page);
                await expect(page).toHaveScreenshot(`subscription-${plan}-${viewport.name}.png`, {
                    fullPage: true,
                });
            },
        );
    }
}

test(
    'Forged and replayed returns never claim Pro; checkout handoff stays pending',
    { tag: '@smoke' },
    async ({ page, context }) => {
        await signInMock(context, 'valid-billing-free-return');
        await page.goto('/settings?tab=subscription&checkout=returned&session_id=foreign&plan=PRO');
        await expect(page.getByText(/Payment confirmation pending/)).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Free Active' })).toBeVisible();
        await page.getByRole('button', { name: 'Refresh subscription status' }).click();
        await expect(page.getByRole('heading', { name: 'Free Active' })).toBeVisible();
        await page.getByRole('button', { name: 'Upgrade to Pro', exact: true }).click();
        await expect(page).toHaveURL(/checkout=returned/);
        await expect(page.getByText(/Payment confirmation pending/)).toBeVisible();
    },
);

test(
    'Provider outage, disabled billing and recovery stay explicit',
    { tag: '@smoke' },
    async ({ page, context }) => {
        await signInMock(context, 'valid-billing-retry-status');
        await page.goto('/settings?tab=subscription');
        await expect(page.getByRole('region', { name: 'Subscription unavailable' })).toBeVisible();
        await page.getByRole('button', { name: 'Refresh subscription status' }).click();
        await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
        await signInMock(context, 'valid-billing-disabled');
        await page.goto('/pricing');
        await expect(
            page.getByRole('button', { name: 'Upgrade to Pro', exact: true }),
        ).toBeDisabled();
        await page.goto('/settings?tab=subscription');
        await expect(
            page.getByRole('button', { name: 'Upgrade to Pro', exact: true }),
        ).toBeDisabled();
    },
);

test(
    'Paid plan shows period-end cancellation, invoices and provider failures',
    { tag: '@smoke' },
    async ({ page, context }) => {
        await signInMock(context, 'valid-billing-pro-cancelled');
        await page.goto('/settings?tab=subscription');
        await expect(page.getByText('Cancellation scheduled for Dec 25, 2026.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Pro monthly invoice' })).toHaveAttribute(
            'href',
            'https://invoice.stripe.com/test-fixture',
        );
        await page.getByRole('button', { name: 'Load more invoices' }).click();
        await expect(page.getByRole('link', { name: 'Pro monthly invoice' })).toHaveCount(2);
        await signInMock(context, 'valid-billing-pro-billing-failure');
        await page.goto('/settings?tab=subscription');
        await expect(page.getByText('Billing history unavailable', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Open billing portal' }).click();
        await expect(page.getByText(/Billing is unavailable/).first()).toBeVisible();
    },
);

test(
    'Pricing sends signed-in users to checkout and preserves offline feedback',
    { tag: '@smoke' },
    async ({ page, context }) => {
        await signInMock(context, 'valid-billing-pricing');
        await page.goto('/pricing');
        await expect(
            page.getByText('Plus applicable tax at checkout. Purchases are sold through Link.'),
        ).toBeVisible();
        await context.setOffline(true);
        await page.getByRole('button', { name: 'Upgrade to Pro', exact: true }).click();
        await expect(
            page.getByRole('status').filter({ hasText: /offline|connection/i }),
        ).toBeVisible();
        await context.setOffline(false);
        await page.getByRole('button', { name: 'Upgrade to Pro', exact: true }).click();
        await expect(page).toHaveURL(/tab=subscription&checkout=returned/);
    },
);

test(
    'Anonymous Pricing enters sign-in before checkout',
    { tag: '@smoke' },
    async ({ page, context }) => {
        await signInMock(context, 'anonymous-billing-enabled');
        await page.goto('/pricing');
        const upgrade = page.getByRole('link', { name: 'Upgrade to Pro', exact: true });
        await expect(upgrade).toHaveAttribute(
            'href',
            '/login?returnTo=%2Fsettings%3Ftab%3Dsubscription',
        );
        await upgrade.click();
        await expect(page).toHaveURL(/\/login\?returnTo=%2Fsettings%3Ftab%3Dsubscription/u);
    },
);
