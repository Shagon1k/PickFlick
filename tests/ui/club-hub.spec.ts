import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { acceptedParticipants } from './session-facts';
import { settle } from './settle';
import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

const FIRST_CLUB_ID = '10000000-0000-4000-8000-000000000031';
const SECOND_CLUB_ID = '10000000-0000-4000-8000-000000000032';

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
    'Club switch replaces every Hub context and saves the last used Club',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-hub-switch');
        await page.goto('/app');
        await expect(page).toHaveURL(new RegExp(`/clubs/${FIRST_CLUB_ID}$`, 'u'));
        await expect(
            page.getByRole('heading', { level: 1, name: 'Midnight Society' }),
        ).toBeVisible();
        await expect(page.getByText('Midnight private screening').first()).toBeVisible();
        await page.getByRole('button', { name: 'Open Second Screening Room' }).focus();
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL(new RegExp(`/clubs/${SECOND_CLUB_ID}$`, 'u'));
        await expect(
            page.getByRole('heading', { level: 1, name: 'Second Screening Room' }),
        ).toBeVisible();
        await expect(page.getByText('Second Club private screening').first()).toBeVisible();
        await expect(page.getByText('Midnight private screening')).toHaveCount(0);
        await expect(page.getByText('Current phase', { exact: true })).toBeVisible();
        await expect(page.getByText('Room A')).toHaveCount(0);

        await page.goto('/app');
        await expect(page).toHaveURL(new RegExp(`/clubs/${SECOND_CLUB_ID}$`, 'u'));
    },
);

test(
    'stale preference and direct unauthorized Hub reveal no Club data',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-hub-revoked');
        await context.addCookies([
            {
                name: 'pickflick.last_club',
                value: SECOND_CLUB_ID,
                domain: '127.0.0.1',
                path: '/',
                httpOnly: true,
                sameSite: 'Lax',
            },
        ]);
        await page.goto('/app');
        await expect(page).toHaveURL(new RegExp(`/clubs/${FIRST_CLUB_ID}$`, 'u'));
        await page.goto(`/clubs/${SECOND_CLUB_ID}`);
        await expect(page.getByRole('heading', { name: 'Club access unavailable' })).toBeVisible();
        await expect(page.getByText('Second Club private screening')).toHaveCount(0);
    },
);

test(
    'direct authorized visits save the preference and inaccessible visits preserve it',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-hub-preference');
        await page.goto(`/clubs/${SECOND_CLUB_ID}`);
        await expect(
            page.getByRole('heading', { level: 1, name: 'Second Screening Room' }),
        ).toBeVisible();

        await page.goto('/clubs/10000000-0000-4000-8000-000000000033');
        await expect(page.getByRole('heading', { name: 'Club access unavailable' })).toBeVisible();
        await page.goto('/app');
        await expect(page).toHaveURL(new RegExp(`/clubs/${SECOND_CLUB_ID}$`, 'u'));
    },
);

test('Hub retries a transient backend failure without signing the member out', async ({
    context,
    page,
}) => {
    await authenticate(context, `valid-hub-transient-${crypto.randomUUID()}`);
    await context.addCookies([
        { name: 'pickflick.last_club', value: FIRST_CLUB_ID, url: 'http://127.0.0.1:41730' },
    ]);
    await page.goto(`/clubs/${FIRST_CLUB_ID}`);
    await expect(
        page.getByRole('heading', { name: 'The Club Hub is temporarily unavailable' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Midnight Society' })).toBeVisible();
    await expect(page.getByText('Call sheet: 001', { exact: true })).toBeVisible();
});

test('archived Hub stays readable without a Session action', async ({ context, page }) => {
    await authenticate(context, 'valid-hub-archived');
    await page.goto(`/clubs/${FIRST_CLUB_ID}`);

    await expect(page.getByRole('region', { name: 'Club status' })).toContainText('read-only');
    await expect(page.getByRole('heading', { level: 1, name: 'Midnight Society' })).toBeVisible();
    await expect(page.getByRole('link', { name: /create session/iu })).toHaveCount(0);
});

test('Club sections keep the switcher and Call Sheet above the active panel', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-hub-tabs');
    await page.goto(`/clubs/${FIRST_CLUB_ID}`);
    await page
        .locator('#hub-context')
        .evaluate((element) => element.setAttribute('data-persisted', 'true'));
    const navigations: string[] = [];
    page.on('request', (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame())
            navigations.push(request.url());
    });
    for (const section of ['Members', 'Manage Club', 'Overview']) {
        await page
            .getByRole('navigation', { name: 'Club sections' })
            .getByRole('link', { name: section, exact: true })
            .click();
        await expect(
            page.getByRole('heading', { level: 1, name: 'Midnight Society' }),
        ).toBeVisible();
        await expect(page.getByText('Call sheet: 001', { exact: true })).toBeVisible();
        await expect(
            page.getByRole('link', {
                name: 'Open Session: Midnight private screening',
                exact: true,
            }),
        ).toHaveAttribute('href', '/sessions/30000000-0000-4000-8000-000000000031');
        await expect(
            page.getByRole('button', { name: 'Open Second Screening Room' }),
        ).toBeVisible();
        await expect(
            page
                .getByRole('navigation', { name: 'Club sections' })
                .getByRole('link', { name: section, exact: true }),
        ).toHaveAttribute('aria-current', 'page');
        await expect(page.locator('#hub-context')).toHaveAttribute('data-persisted', 'true');
    }
    expect(navigations).toEqual([]);
});

test('Hub meets keyboard, touch, accessibility, and width contracts', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true });
    try {
        await authenticate(context, 'valid-hub-touch');
        const page = await context.newPage();
        for (const viewport of [...canonicalViewports, ...gapViewports]) {
            await page.setViewportSize(viewport);
            await page.goto(`/clubs/${FIRST_CLUB_ID}`, { waitUntil: 'load' });
            await settle(page);
            const widths = await page.evaluate(() => ({
                body: document.body.scrollWidth,
                client: document.documentElement.clientWidth,
                document: document.documentElement.scrollWidth,
            }));
            expect(widths.body).toBeLessThanOrEqual(widths.client);
            expect(widths.document).toBeLessThanOrEqual(widths.client);
        }
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        const next = page.getByRole('button', { name: 'Open Second Screening Room' });
        expect((await next.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await next.tap();
        await expect(page).toHaveURL(new RegExp(`/clubs/${SECOND_CLUB_ID}$`, 'u'));
        await page
            .getByRole('link', {
                name: 'Open active Session: Second Club private screening',
                exact: true,
            })
            .tap();
        await expect(page).toHaveURL(/\/sessions\/30000000-0000-4000-8000-000000000032$/u);
    } finally {
        await context.close();
    }
});

test('Club carousel ends with creation and shows only the prototype caption', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-hub-carousel');
    await page.goto(`/clubs/${FIRST_CLUB_ID}`);
    await expect(page.getByText('2 members · 1 session · Est. January 2025')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create a Club', exact: true })).toHaveCount(0);
    await expect(page.getByText('Noir, classics, and arguments.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous Club' }).click();
    await expect(page.getByRole('link', { name: 'Create new club' })).toHaveAttribute(
        'href',
        '/clubs/new',
    );
    await expect(page.getByRole('link', { name: /^Open Session:/u })).toHaveCount(0);
    await page.getByRole('button', { name: 'Next Club' }).click();
    await expect(page.getByRole('heading', { name: 'Midnight Society' })).toBeVisible();
});

test('Watching Call Sheet uses the Session ordinal, weekday and actual selected film metadata', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-hub-watching');
    await page.goto(`/clubs/${FIRST_CLUB_ID}`);
    const sheet = page.getByRole('link', { name: 'Open Session: Selected film', exact: true });
    await expect(sheet).toContainText('Call sheet: 047');
    await expect(sheet).toContainText('Friday unit');
    await expect(sheet).toContainText('Oct 16');
    await expect(sheet).toContainText('2h 46m');
    await expect(sheet).toContainText('Sci-Fi');
    await expect(sheet).not.toContainText('2026');
    const statistics = page.getByRole('region', { name: 'Club statistics' });
    await expect(statistics.locator('strong')).toHaveText(Array(7).fill('—'));
    await page
        .getByRole('navigation', { name: 'Club sections' })
        .getByRole('link', { name: 'Manage Club' })
        .click();
    await expect(page.getByRole('heading', { name: 'Active Session', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active Ratings', exact: true })).toBeVisible();
    const sheetBounds = await sheet.boundingBox();
    const panelBounds = await page
        .getByRole('region', { name: 'Manage Club', exact: true })
        .boundingBox();
    expect(sheetBounds).not.toBeNull();
    expect(panelBounds).not.toBeNull();
    expect(panelBounds?.x).toBe(sheetBounds?.x);
    expect(panelBounds?.width).toBe(sheetBounds?.width);
});

test('Club member joins the active Session directly from Overview', async ({ context, page }) => {
    await authenticate(context, `valid-session-roster-member-direct-hub-${crypto.randomUUID()}`);
    await page.goto(`/clubs/${FIRST_CLUB_ID}`);
    await page.getByRole('button', { name: 'Join me!' }).click();
    await expect(page).toHaveURL(/\/sessions\/30000000-0000-4000-8000-000000000041$/u);
    await expect(acceptedParticipants(page)).toHaveText('Jordan Member');
});

for (const viewport of screenshotViewports) {
    test(
        `Club Hub matches the ${viewport.name} source-comparison capture`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, `valid-hub-visual-${viewport.name}`);
            await page.setViewportSize(viewport);
            await page.goto(`/clubs/${FIRST_CLUB_ID}`, { waitUntil: 'load' });
            await settle(page);
            await expect(page).toHaveScreenshot(`club-hub-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        },
    );
}
