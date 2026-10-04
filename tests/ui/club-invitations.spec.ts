import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

const tokens = {
    valid: 'v',
    expired: 'e',
    revoked: 'r',
    full: 'f',
    member: 'm',
    paused: 'p',
    invalid: 'i',
    error: 'z',
};
const titles = {
    valid: 'You are invited',
    expired: 'Invitation expired',
    revoked: 'Invitation revoked',
    full: 'The Club is full',
    member: 'You are already a member',
    paused: 'Invitations are paused',
    invalid: 'Invitation unavailable',
    error: 'Please try again',
};
const invitationPath = (state: keyof typeof tokens = 'valid') =>
    `/invite/club/${tokens[state].repeat(43)}`;

async function signIn(context: BrowserContext, name: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `valid-invitation-${name}`,
            url: 'http://127.0.0.1:41730',
        },
    ]);
}

test(
    'Club invitation continues through sign-in and accepts into the correct Hub',
    { tag: '@smoke' },
    async ({ page }) => {
        const destination = invitationPath();
        await page.goto(destination);
        await expect(page.getByRole('heading', { name: 'Your invitation awaits' })).toBeVisible();
        await expect(page.getByText('Midnight Society')).toHaveCount(0);
        await page.getByRole('link', { name: 'Sign in to continue' }).click();
        let callback: unknown;
        await page.route('**/api/auth/sign-in/social', async (route) => {
            const body = route.request().postDataJSON() as { callbackURL: string };
            callback = body.callbackURL;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: {
                    'set-cookie':
                        'pickflick.session_token=valid-invitation-auth-continuation; Path=/; HttpOnly; SameSite=Lax',
                },
                body: JSON.stringify({ redirect: true, url: body.callbackURL }),
            });
        });
        await page.getByRole('button', { name: 'Continue with Google' }).click();
        await expect(page.getByRole('heading', { name: 'You are invited' })).toBeVisible();
        expect(callback).toBe(destination);
        await page.getByRole('button', { name: 'Accept Invitation' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('heading', { name: 'Welcome to the Club' })).toBeVisible();
        await page.getByRole('link', { name: 'Open Screening Room' }).click();
        await expect(page).toHaveURL(/\/clubs\/10000000-0000-4000-8000-000000000031$/);
        await expect(
            page.getByRole('heading', { level: 1, name: 'Midnight Society' }),
        ).toBeVisible();
    },
);

test('Club invitation declines without membership and keeps network failures retryable', async ({
    context,
    page,
}) => {
    await signIn(context, 'decline');
    await page.goto(invitationPath());
    await page.context().setOffline(true);
    await page.getByRole('button', { name: "No thanks, I'll pass" }).click();
    await expect(page.getByRole('status')).toContainText('could not be updated');
    await page.context().setOffline(false);
    await page.getByRole('button', { name: "No thanks, I'll pass" }).click();
    await expect(page.getByRole('heading', { name: 'Invitation declined' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Screening Room' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Invitation declined' })).toBeVisible();
});

test('Club invitation states keep stable geometry, privacy, and accessible recovery at every width', async ({
    context,
    page,
}) => {
    await signIn(context, 'geometry');
    for (const viewport of [...canonicalViewports, ...gapViewports]) {
        await page.setViewportSize(viewport);
        await page.goto(invitationPath());
        await expect(page.getByRole('heading', { name: titles.valid })).toBeVisible();
        await settle(page);
        const validBox = await page
            .locator('[aria-label="Club invitation"] [aria-busy]')
            .boundingBox();
        for (const state of [
            'expired',
            'revoked',
            'full',
            'member',
            'paused',
            'invalid',
            'error',
        ] as const) {
            const response = await page.goto(invitationPath(state), { waitUntil: 'load' });
            await expect(page.getByRole('heading', { name: titles[state] })).toBeVisible();
            await settle(page);
            expect(response?.headers()['referrer-policy']).toBe('no-referrer');
            const card = page.locator('[aria-label="Club invitation"] [aria-busy]');
            const box = await card.boundingBox();
            expect(box).not.toBeNull();
            expect(box?.height, `${viewport.name} ${state}`).toBe(validBox?.height);
            expect(box?.width, `${viewport.name} ${state}`).toBe(validBox?.width);
            await expect(page.getByText('Midnight Society')).toHaveCount(0);
            const dimensions = await page.evaluate(() => ({
                scroll: document.documentElement.scrollWidth,
                width: document.documentElement.clientWidth,
            }));
            expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
        }
    }
    for (const viewport of canonicalViewports) {
        await page.setViewportSize(viewport);
        await signIn(context, `success-${viewport.name}`);
        await page.goto(invitationPath());
        await expect(page.getByRole('heading', { name: titles.valid })).toBeVisible();
        await settle(page);
        const card = page.locator('[aria-label="Club invitation"] [aria-busy]');
        const original = await card.boundingBox();
        await page.getByRole('button', { name: 'Accept Invitation' }).click();
        await expect(page.getByRole('heading', { name: 'Welcome to the Club' })).toBeVisible();
        expect((await card.boundingBox())?.height).toBe(original?.height);
        await signIn(context, `declined-${viewport.name}`);
        await page.goto(invitationPath());
        await page.getByRole('button', { name: "No thanks, I'll pass" }).click();
        await expect(page.getByRole('heading', { name: 'Invitation declined' })).toBeVisible();
        expect((await card.boundingBox())?.height).toBe(original?.height);
        await context.clearCookies();
        await page.goto(invitationPath());
        await expect(page.getByRole('heading', { name: 'Your invitation awaits' })).toBeVisible();
        expect((await card.boundingBox())?.height).toBe(original?.height);
    }
    await signIn(context, 'accessibility');
    for (const viewport of screenshotViewports) {
        await page.setViewportSize(viewport);
        await page.goto(invitationPath());
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        for (const button of await page.getByRole('button').all()) {
            expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        }
    }
});

test('Maximum-length Club names keep invitation geometry after acceptance and decline', async ({
    context,
    page,
}, testInfo) => {
    for (const viewport of [...canonicalViewports, ...gapViewports]) {
        await page.setViewportSize(viewport);
        for (const decision of ['accept', 'decline'] as const) {
            await signIn(context, `long-name-${decision}-${viewport.name}`);
            await page.goto(invitationPath(), { waitUntil: 'load' });
            const name = page.getByRole('heading', { level: 2, name: 'W'.repeat(100) });
            await expect(name).toBeVisible();
            await settle(page);
            const card = page.locator('[aria-label="Club invitation"] [aria-busy]');
            const original = await card.boundingBox();
            const dimensions = await page.evaluate(() => ({
                scroll: document.documentElement.scrollWidth,
                width: document.documentElement.clientWidth,
            }));
            expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
            expect(await name.evaluate((heading) => heading.scrollWidth)).toBeGreaterThan(
                await name.evaluate((heading) => heading.clientWidth),
            );
            await page.screenshot({
                path: testInfo.outputPath(`long-name-${decision}-${viewport.name}.png`),
                fullPage: true,
            });
            await page
                .getByRole('button', {
                    name: decision === 'accept' ? 'Accept Invitation' : "No thanks, I'll pass",
                })
                .click();
            await expect(
                page.getByRole('heading', {
                    name: decision === 'accept' ? 'Welcome to the Club' : 'Invitation declined',
                }),
            ).toBeVisible();
            await settle(page);
            const result = await card.boundingBox();
            expect(result?.height).toBe(original?.height);
            expect(result?.width).toBe(original?.width);
            await expect(name).toHaveCount(0);
        }
    }
});

test('Club Admin keeps a created link usable when refreshing invitations fails', async ({
    context,
    page,
}) => {
    await signIn(context, 'refresh-failure');
    await page.goto('/clubs/10000000-0000-4000-8000-000000000031/settings');
    await page.getByRole('button', { name: 'Create invitation' }).click();
    const link = page.getByLabel('Invitation link');
    await expect(link).toHaveValue(/\/invite\/club\/[A-Za-z0-9_-]{43}$/);
    await expect(page.getByRole('status').last()).toContainText(
        'Invitation created. Share this link',
    );
    await expect(page.getByRole('status').last()).toContainText('could not be refreshed');
    await expect(page.getByRole('button', { name: 'Revoke invitation' })).toBeVisible();
    const original = await link.inputValue();
    await page.getByRole('button', { name: 'Recent invitations' }).click();
    await expect(page.getByRole('status').last()).toHaveText('Recent invitations loaded.');
    await expect(link).toHaveValue(original);
    await page.getByRole('button', { name: 'Revoke invitation' }).click();
    await expect(link).toHaveCount(0);
});

test('Club Admin creates, copies, and revokes a link through Manage Club', async ({
    context,
    page,
}) => {
    await signIn(context, 'manager');
    await page.goto('/clubs/10000000-0000-4000-8000-000000000031/settings');
    await page.getByRole('button', { name: 'Create invitation' }).click();
    await expect(page.getByLabel('Invitation link')).toHaveValue(
        /\/invite\/club\/[A-Za-z0-9_-]{43}$/,
    );
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('status').last()).toHaveText(/copied|Copy is unavailable/);
    await page.getByRole('button', { name: 'Revoke invitation' }).click();
    await expect(page.getByLabel('Invitation link')).toHaveCount(0);
    await expect(page.getByRole('status').last()).toHaveText('Invitation revoked.');
});

for (const viewport of screenshotViewports) {
    for (const state of [
        'valid',
        'expired',
        'revoked',
        'full',
        'member',
        'paused',
        'invalid',
        'error',
        'sign-in',
    ] as const) {
        test(
            `Club invitation ${state} at ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await page.setViewportSize(viewport);
                await context.addCookies([
                    {
                        name: 'pickflick.session_token',
                        value:
                            state === 'sign-in'
                                ? 'forged'
                                : `valid-visual-${state}-${viewport.name}`,
                        url: 'http://127.0.0.1:41730',
                    },
                ]);
                await page.goto(invitationPath(state === 'sign-in' ? 'valid' : state), {
                    waitUntil: 'load',
                });
                await expect(
                    page.getByRole('heading', {
                        name: state === 'sign-in' ? 'Your invitation awaits' : titles[state],
                    }),
                ).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(
                    `club-invitation-${state}-${viewport.name}.png`,
                    { fullPage: true, scale: 'css' },
                );
            },
        );
    }
}

for (const viewport of screenshotViewports) {
    for (const decision of ['accept', 'decline'] as const) {
        test(
            `Club invitation ${decision} outcome at ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await page.setViewportSize(viewport);
                await signIn(context, `visual-${decision}-${viewport.name}`);
                await page.goto(invitationPath());
                await page
                    .getByRole('button', {
                        name: decision === 'accept' ? 'Accept Invitation' : "No thanks, I'll pass",
                    })
                    .click();
                await expect(
                    page.getByRole('heading', {
                        name: decision === 'accept' ? 'Welcome to the Club' : 'Invitation declined',
                    }),
                ).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(
                    `club-invitation-${decision}-${viewport.name}.png`,
                    { fullPage: true, scale: 'css' },
                );
            },
        );
    }
}
