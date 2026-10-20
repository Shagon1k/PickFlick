import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

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
        await expect(page.getByText('Room B')).toBeVisible();
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
    await expect(page.getByText('Screening Call Sheet', { exact: true })).toBeVisible();
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
    for (const section of ['Members', 'Manage Club', 'Overview']) {
        await page
            .getByRole('navigation', { name: 'Club sections' })
            .getByRole('link', { name: section, exact: true })
            .click();
        await expect(
            page.getByRole('heading', { level: 1, name: 'Midnight Society' }),
        ).toBeVisible();
        await expect(page.getByText('Screening Call Sheet', { exact: true })).toBeVisible();
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
    }
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
            .getByText('Phase: rating', { exact: true })
            .tap();
        await expect(page).toHaveURL(/\/sessions\/30000000-0000-4000-8000-000000000032$/u);
    } finally {
        await context.close();
    }
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
