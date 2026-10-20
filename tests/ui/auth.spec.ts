import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports, screenshotViewports } from './viewports';

async function openLogin(
    page: Page,
    viewport: { height: number; width: number } = canonicalViewports[0],
    route = '/login',
) {
    await page.setViewportSize(viewport);
    await page.goto(route, { waitUntil: 'load' });
    await settle(page);
}

test('Login is accessible with Google while dormant Apple Sign In stays hidden', async ({
    page,
}) => {
    for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
        await openLogin(page, viewport);
        await expect(
            page.getByRole('heading', { level: 1, name: 'Welcome to PickFlick' }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Continue with Apple' })).toHaveCount(0);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
});

test('Login redirects an authenticated User to the app', async ({ context, page }) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid',
            url: 'http://127.0.0.1:41730',
        },
    ]);

    await page.goto('/login');
    await expect(page).toHaveURL(/\/app$/);
});

test('Login remains available for a forged session cookie', async ({ context, page }) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'forged',
            url: 'http://127.0.0.1:41730',
        },
    ]);

    await openLogin(page);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Welcome to PickFlick' }),
    ).toBeVisible();
});

test('Login has no horizontal overflow at canonical and bridge widths', async ({ page }) => {
    for (const viewport of [
        ...canonicalViewports,
        { height: 900, name: 'bridge-640', width: 640 },
    ]) {
        await openLogin(page, viewport);
        const dimensions = await page.evaluate(() => ({
            body: globalThis.document.body.scrollWidth,
            client: globalThis.document.documentElement.clientWidth,
            document: globalThis.document.documentElement.scrollWidth,
        }));
        expect(dimensions.document, viewport.name).toBeLessThanOrEqual(dimensions.client);
        expect(dimensions.body, viewport.name).toBeLessThanOrEqual(dimensions.client);
    }
});

for (const viewport of screenshotViewports) {
    test(
        `Login matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ page }) => {
            await openLogin(page, viewport);
            await expect(page).toHaveScreenshot(`login-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );
}

test('Google sign-in sends only an allowlisted return target and stores no token material', async ({
    page,
}) => {
    let requestBody: Record<string, unknown> | undefined;
    await page.route('**/api/auth/sign-in/social', async (route) => {
        requestBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ redirect: true, url: '/login?oauth_started=1' }),
            status: 200,
        });
    });

    await openLogin(
        page,
        canonicalViewports[0],
        '/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal',
    );
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page).toHaveURL(/oauth_started=1/);
    expect(requestBody).toMatchObject({ callbackURL: '/app', provider: 'google' });
    expect(JSON.stringify(requestBody)).not.toMatch(/token|secret/i);

    const storage = await page.evaluate(() => ({
        local: Object.keys(globalThis.localStorage),
        session: Object.keys(globalThis.sessionStorage),
    }));
    expect(storage).toEqual({ local: [], session: [] });
});

test('Login explains social sign-in rate limits and keeps retry available', async ({ page }) => {
    await page.route('**/api/auth/sign-in/social', (route) =>
        route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
                code: 'TOO_MANY_REQUESTS',
                message: 'internal provider detail',
            }),
        }),
    );
    await openLogin(page);
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('status')).toHaveText(
        'Too many sign-in attempts. Wait a minute, then try again.',
    );
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    await expect(page.getByText('internal provider detail')).toHaveCount(0);
});

test('Login can recheck the current account after a session service failure', async ({
    context,
    page,
}) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'session-api-unavailable',
            url: 'http://127.0.0.1:41730',
        },
    ]);
    await openLogin(page);
    await expect(
        page.getByRole('alert').filter({ hasText: 'We could not check your session' }),
    ).toBeVisible();
    await context.clearCookies();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText('We could not check your session', { exact: false })).toHaveCount(
        0,
    );
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
});

test('Login preserves a supported invitation and never reflects raw provider errors', async ({
    page,
}) => {
    let requestBody: Record<string, unknown> | undefined;
    await page.route('**/api/auth/sign-in/social', async (route) => {
        requestBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ redirect: true, url: '/login?oauth_started=1' }),
            status: 200,
        });
    });

    await openLogin(
        page,
        canonicalViewports[3],
        '/login?returnTo=%2Finvite%2Fclub%2Finvite_token-123&error=provider-secret-detail',
    );
    await expect(page.locator('main').getByRole('alert')).toHaveText(
        'Sign-in could not be completed safely. Please try again.',
    );
    await expect(page.getByText('provider-secret-detail')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    expect(requestBody).toMatchObject({
        callbackURL: '/invite/club/invite_token-123',
        provider: 'google',
    });
});
