import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { openAt } from './settle';
import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

test('protected Club onboarding redirects an unauthenticated visitor', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL('/login?returnTo=%2Fapp');
    await page.goto('/clubs/new');
    await expect(page).toHaveURL('/login?returnTo=%2Fclubs%2Fnew');
});

test('Create Club and Login surface an unavailable session API instead of signing out', async ({
    context,
    page,
}) => {
    await signInMock(context, 'session-api-unavailable');
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
    await signInMock(context, 'valid-login-return');
    await page.goto('/login?returnTo=/clubs/new');
    await expect(page).toHaveURL(/\/clubs\/new$/u);
});

test('no-Clubs and Create Club have no automated accessibility violations', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-accessibility');
    for (const route of ['/app', '/clubs/new']) {
        for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
            await openAt(page, route, viewport);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        }
    }
});

test('Club onboarding does not overflow across canonical and gap widths', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-overflow');
    for (const route of ['/app', '/clubs/new']) {
        for (const viewport of [...canonicalViewports, ...gapViewports]) {
            await openAt(page, route, viewport);
            await expectNoPageOverflow(page, `${route} at ${viewport.width}px`);
        }
    }
});

test('invalid Club values stay in the form and move focus to accessible validation', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-validation');
    await openAt(page, '/clubs/new', canonicalViewports[0]);

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
    await signInMock(context, `valid-create-success-${crypto.randomUUID()}`);
    await openAt(page, '/clubs/new', canonicalViewports[1]);

    await page.getByRole('textbox', { name: 'Club name — required' }).fill('Midnight Society');
    await page.getByRole('textbox', { name: 'Description' }).fill('Noir and classic cinema.');
    await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/app');
    const scaleEnd = page.getByRole('slider', { name: 'Selection score range' });
    await expect(scaleEnd).toHaveAttribute('min', '1');
    await scaleEnd.fill('7');
    await expect(scaleEnd).toHaveAttribute('aria-valuetext', 'Scores run 0 to 7');
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
        await signInMock(context, 'valid-touch');
        const page = await context.newPage();
        await openAt(page, '/app', canonicalViewports[0]);
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
            await signInMock(context, `valid-no-clubs-${viewport.name}`);
            await openAt(page, '/app', viewport);
            await expect(page).toHaveScreenshot(`no-clubs-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );

    test(
        `Create Club matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await signInMock(context, `valid-create-club-${viewport.name}`);
            await openAt(page, '/clubs/new', viewport);
            await expect(page).toHaveScreenshot(`create-club-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );
}
