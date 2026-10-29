import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { acceptedParticipants } from './session-facts';
import { settle } from './settle';
import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

const FIRST_CLUB_ID = '10000000-0000-4000-8000-000000000031';
const SECOND_CLUB_ID = '10000000-0000-4000-8000-000000000032';

async function authenticate(context: BrowserContext, token: string) {
    await signInMock(context, token);
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
        await page.getByRole('button', { name: 'Next Club' }).focus();
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL(new RegExp(`/clubs/${SECOND_CLUB_ID}$`, 'u'));
        await expect(
            page.getByRole('heading', { level: 1, name: 'Second Screening Room' }),
        ).toBeVisible();
        await expect(page.getByText('Second Club private screening').first()).toBeVisible();
        await expect(page.getByText('Midnight private screening')).toHaveCount(0);
        await expect(page.getByText('No screening scheduled', { exact: true })).toBeVisible();
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
    await expect(page.getByText('Call sheet 001', { exact: true })).toBeVisible();
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
        await expect(page.getByText('Call sheet 001', { exact: true })).toBeVisible();
        await expect(
            page.getByRole('link', {
                name: 'Open Session: Midnight private screening',
                exact: true,
            }),
        ).toHaveAttribute('href', '/sessions/30000000-0000-4000-8000-000000000031');
        await expect(page.getByRole('button', { name: 'Next Club' })).toBeVisible();
        await expect(
            page
                .getByRole('navigation', { name: 'Club sections' })
                .getByRole('link', { name: section, exact: true }),
        ).toHaveAttribute('aria-current', 'page');
        await expect(page.locator('#hub-context')).toHaveAttribute('data-persisted', 'true');
    }
    expect(navigations).toEqual([]);
});

const sectionSwitches = [
    {
        viewport: canonicalViewports[3],
        open: (page: Page) =>
            page
                .getByRole('navigation', { name: 'Club sections' })
                .getByRole('link', { name: 'Members', exact: true })
                .click(),
        current: (page: Page) =>
            expect(
                page
                    .getByRole('navigation', { name: 'Club sections' })
                    .getByRole('link', { name: 'Members', exact: true }),
            ).toHaveAttribute('aria-current', 'page'),
    },
    {
        viewport: canonicalViewports[0],
        open: async (page: Page) => {
            await page
                .getByRole('navigation', { name: 'Mobile product navigation' })
                .getByRole('button', { name: 'Overview' })
                .click();
            await page
                .locator('[data-anchored-menu=hub]')
                .getByRole('link', { name: 'Members' })
                .click();
        },
        // Phones name the current section on the bottom bar's Hub trigger.
        current: (page: Page) =>
            expect(page.getByRole('button', { name: 'Members', exact: true })).toBeVisible(),
    },
];

for (const { viewport, open, current } of sectionSwitches) {
    test(`a Club section switch shows the panel skeleton at once at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await page.setViewportSize(viewport);
        await authenticate(context, 'valid-hub-tabs');
        const members = `/clubs/${FIRST_CLUB_ID}/members`;
        const isPrefetch = (headers: Record<string, string>) =>
            Object.keys(headers).some((name) => name.includes('prefetch'));
        const prefetched = page.waitForResponse(
            (response) =>
                response.url().includes(members) && isPrefetch(response.request().headers()),
        );
        await page.goto(`/clubs/${FIRST_CLUB_ID}`);
        await prefetched;
        // Hold only the navigation; the prefetched loading boundary must render without it.
        let release = () => {};
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.route(`**${members}**`, async (route) => {
            if (!isPrefetch(route.request().headers())) await held;
            await route.continue();
        });
        await open(page);

        const skeleton = page.getByRole('status').filter({ hasText: 'Loading Club section' });
        await expect(skeleton).toBeVisible();
        await expect(page.locator('[data-anchored-menu=hub]')).toBeHidden();
        await current(page);
        await expect(page.getByText('Call sheet 001', { exact: true })).toBeVisible();
        release();
        await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();
        await expect(skeleton).toHaveCount(0);
    });
}

test('a sideways swipe over the Club name switches Clubs on phones', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true });
    try {
        await authenticate(context, 'valid-hub-swipe');
        const page = await context.newPage();
        await page.setViewportSize(canonicalViewports[0]);
        await page.goto(`/clubs/${FIRST_CLUB_ID}`);
        const title = page.getByRole('heading', { level: 1, name: 'Midnight Society' });
        await expect(title).toBeVisible();
        await title.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const touch = (clientX: number) =>
                new Touch({ identifier: 1, target: element, clientX, clientY: box.top + 10 });
            const start = touch(box.right - 20);
            const end = touch(box.left + 20);
            element.dispatchEvent(
                new TouchEvent('touchstart', {
                    bubbles: true,
                    touches: [start],
                    changedTouches: [start],
                }),
            );
            element.dispatchEvent(
                new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }),
            );
        });
        await expect(page).toHaveURL(new RegExp(`/clubs/${SECOND_CLUB_ID}$`, 'u'));
    } finally {
        await context.close();
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
        const next = page.getByRole('button', { name: 'Next Club' });
        expect((await next.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await next.tap();
        await expect(page).toHaveURL(new RegExp(`/clubs/${SECOND_CLUB_ID}$`, 'u'));
        await page
            .getByRole('heading', { name: 'Active Ratings' })
            .locator('..')
            .getByRole('link', { name: 'Second Club private screening', exact: true })
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
    await expect(sheet).toContainText('Call sheet 047');
    await expect(sheet).toContainText('Friday unit');
    await expect(sheet).toContainText('Oct 16');
    await expect(sheet).toContainText('2h 46m');
    await expect(sheet).toContainText('Sci-Fi');
    await expect(sheet).not.toContainText('2026');
    const statistics = page.getByRole('region', { name: 'Club statistics' });
    await expect(statistics.locator('strong')).toHaveText(['0', '0']);
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
