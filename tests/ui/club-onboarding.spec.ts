import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

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

async function open(page: Page, route: string, viewport: { height: number; width: number }) {
    await page.setViewportSize(viewport);
    await page.goto(route, { waitUntil: 'load' });
    await settle(page);
}

function widths(page: Page) {
    return page.evaluate(() => ({
        body: globalThis.document.body.scrollWidth,
        client: globalThis.document.documentElement.clientWidth,
        document: globalThis.document.documentElement.scrollWidth,
    }));
}

test('protected Club onboarding redirects an unauthenticated visitor', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login\?returnTo=\/app$/u);
    await page.goto('/clubs/new');
    await expect(page).toHaveURL(/\/login\?returnTo=\/clubs\/new$/u);
});

test('Create Club and Login surface an unavailable session API instead of signing out', async ({
    context,
    page,
}) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'session-api-unavailable',
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
    await page.goto('/clubs/new');
    await expect(page).toHaveURL(/\/clubs\/new$/u);
    await expect(
        page.getByRole('alert').filter({ hasText: 'could not confirm your session' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
        'href',
        '/clubs/new',
    );

    await page.goto('/login');
    await expect(
        page.getByRole('alert').filter({ hasText: 'could not check your session' }),
    ).toBeVisible();
});

test('signed-in Login returns to the requested allowed target', async ({ context, page }) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-login-return',
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
    await page.goto('/login?returnTo=/clubs/new');
    await expect(page).toHaveURL(/\/clubs\/new$/u);
});

test('no-Clubs and Create Club have no automated accessibility violations', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-accessibility');
    for (const route of ['/app', '/clubs/new']) {
        for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
            await open(page, route, viewport);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        }
    }
});

test('Club onboarding does not overflow across canonical and gap widths', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-overflow');
    for (const route of ['/app', '/clubs/new']) {
        for (const viewport of [...canonicalViewports, ...gapViewports]) {
            await open(page, route, viewport);
            const dimensions = await widths(page);
            expect(
                dimensions.document,
                `${route} document at ${viewport.width}px`,
            ).toBeLessThanOrEqual(dimensions.client);
            expect(dimensions.body, `${route} body at ${viewport.width}px`).toBeLessThanOrEqual(
                dimensions.client,
            );
        }
    }
});

test('invalid Club values stay in the form and move focus to accessible validation', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-validation');
    await open(page, '/clubs/new', canonicalViewports[0]);

    const name = page.getByRole('textbox', { name: 'Club name — required' });
    await name.fill('No');
    await page.getByRole('button', { name: 'Create Screening Room' }).click();

    await expect(name).toHaveValue('No');
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('status')).toContainText('Review the highlighted fields');
});

test('a valid Club creation opens the new Free Club with its configured scale', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-create-success');
    await open(page, '/clubs/new', canonicalViewports[1]);

    await page.getByRole('textbox', { name: 'Club name — required' }).fill('Midnight Society');
    await page.getByRole('textbox', { name: 'Description' }).fill('Noir and classic cinema.');
    await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/app');
    const scaleEnd = page.getByRole('slider', { name: 'Selection score range' });
    await expect(scaleEnd).toHaveAttribute('min', '1');
    await scaleEnd.fill('7');
    await expect(page.getByText('Members score nominations 0–7')).toBeVisible();
    const scaleHelp = page.getByRole('button', { name: 'About the Selection score range' });
    await scaleHelp.focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(scaleHelp).toHaveAccessibleDescription(/highest score members can give/u);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toBeHidden();
    await page.getByRole('button', { name: 'Create Screening Room' }).click();

    await expect(page).toHaveURL(/\/clubs\/10000000-0000-4000-8000-000000000099$/u);
    await expect(page.getByRole('heading', { level: 1, name: 'Midnight Society' })).toBeVisible();
    await expect(page.getByText('1 member · 0 sessions · Est. October 2026')).toBeVisible();
    await expect(page.getByText('Selection scale 0–7')).toHaveCount(0);
});

test('the no-Clubs action meets the touch target contract', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: canonicalViewports[0],
    });
    try {
        await authenticate(context, 'valid-touch');
        const page = await context.newPage();
        await open(page, '/app', canonicalViewports[0]);
        const create = page.getByRole('link', { name: 'Create a Club' });
        expect((await create.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await create.tap();
        await expect(page).toHaveURL(/\/clubs\/new$/u);
    } finally {
        await context.close();
    }
});

for (const viewport of screenshotViewports) {
    test(
        `no-Clubs matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-no-clubs-${viewport.name}`);
            await open(page, '/app', viewport);
            await expect(page).toHaveScreenshot(`no-clubs-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );

    test(
        `Create Club matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-create-club-${viewport.name}`);
            await open(page, '/clubs/new', viewport);
            await expect(page).toHaveScreenshot(`create-club-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );
}
