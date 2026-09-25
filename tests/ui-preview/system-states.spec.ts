import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

const NOT_FOUND_ROUTE = '/missing-reel-system-state-check';
const ERROR_PREVIEW_ROUTE = '/ui-preview/error-recovery';
const PRIVATE_DIAGNOSTIC = 'Preview provider failure with a deliberately long diagnostic payload';
async function waitForAssets(page: Page) {
    await page.evaluate(async () => {
        await globalThis.document.fonts.ready;
        await Promise.all(
            [...globalThis.document.images].map((image) =>
                image.complete
                    ? Promise.resolve()
                    : new Promise<void>((resolveImage) => {
                          image.addEventListener('load', () => resolveImage(), { once: true });
                          image.addEventListener('error', () => resolveImage(), { once: true });
                      }),
            ),
        );
    });
}

async function openNotFound(page: Page, viewport: { height: number; width: number }) {
    await page.setViewportSize(viewport);
    const response = await page.goto(NOT_FOUND_ROUTE, { waitUntil: 'networkidle' });
    await waitForAssets(page);
    return response;
}

async function openApplicationError(page: Page, viewport: { height: number; width: number }) {
    await page.setViewportSize(viewport);
    await page.goto(ERROR_PREVIEW_ROUTE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Simulate provider failure' }).click();
    await expect(
        page.getByRole('heading', { level: 1, name: 'Projector Malfunction' }),
    ).toBeVisible();
    await page
        .locator(
            '[data-system-state="application-error"] .visual, [data-system-state="application-error"] .body',
        )
        .evaluateAll(async (elements) => {
            await Promise.all(
                elements.flatMap((element) =>
                    element
                        .getAnimations()
                        .map((animation) => animation.finished.catch(() => undefined)),
                ),
            );
        });
    await waitForAssets(page);
}

function pageWidths(page: Page) {
    return page.evaluate(() => ({
        body: globalThis.document.body.scrollWidth,
        client: globalThis.document.documentElement.clientWidth,
        document: globalThis.document.documentElement.scrollWidth,
    }));
}

test('unmatched routes return a private, branded 404 with safe recovery', async ({ page }) => {
    const response = await openNotFound(page, canonicalViewports[3]);

    expect(response?.status()).toBe(404);
    const recovery = page.getByRole('region', { name: 'Reel Not Found' });
    await expect(recovery.getByRole('heading', { level: 1, name: 'Reel Not Found' })).toBeVisible();
    await expect(page.getByText(NOT_FOUND_ROUTE)).toHaveCount(0);
    await expect(recovery.getByRole('link', { name: 'Back to main' })).toHaveAttribute('href', '/');
    await expect(
        page.getByRole('navigation', { exact: true, name: 'Public navigation' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Footer navigation' })).toBeVisible();
});

test('application failures hide diagnostics and recover through retry', async ({ page }) => {
    await openApplicationError(page, canonicalViewports[3]);

    await expect(page.getByText(PRIVATE_DIAGNOSTIC, { exact: false })).toHaveCount(0);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Projector Malfunction' }),
    ).toBeFocused();
    expect(await page.evaluate(() => globalThis.scrollY)).toBe(0);
    const recovery = page.getByRole('region', { name: 'Projector Malfunction' });
    await expect(recovery.getByRole('link', { name: 'Back to main' })).toHaveAttribute('href', '/');
    await expect(recovery.getByRole('link', { name: 'Back to Hub' })).toHaveCount(0);

    await page.keyboard.press('Tab');
    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('heading', { level: 1, name: 'Error recovery preview' }),
    ).toBeVisible();
});

test('signed-in application failures recover inside the product shell', async ({ page }) => {
    await page.route('**/api/auth/get-session', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            json: {
                session: {
                    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
                    id: 'preview-session',
                    userId: 'preview-user',
                },
                user: { email: 'preview@example.com', id: 'preview-user', name: 'Preview User' },
            },
            status: 200,
        });
    });
    await openApplicationError(page, canonicalViewports[3]);

    const recovery = page.getByRole('region', { name: 'Projector Malfunction' });
    await expect(
        page.getByRole('navigation', { exact: true, name: 'Product navigation' }),
    ).toBeVisible();
    await expect(recovery.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(recovery.getByRole('link', { name: 'Back to Hub' })).toHaveAttribute(
        'href',
        '/app',
    );
    await expect(recovery.getByRole('link', { name: 'Back to main' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Footer navigation' })).toBeVisible();
});

test('recovery actions support touch and meet the target-size contract', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: canonicalViewports[0],
    });
    const page = await context.newPage();

    try {
        await openNotFound(page, canonicalViewports[0]);
        const home = page
            .getByRole('region', { name: 'Reel Not Found' })
            .getByRole('link', { name: 'Back to main' });
        const box = await home.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        await home.tap();
        await expect(page).toHaveURL('/');
    } finally {
        await context.close();
    }
});

test('system states have no automated accessibility violations', async ({ page }) => {
    for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
        await openNotFound(page, viewport);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

        await openApplicationError(page, viewport);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
});

test('system states do not overflow across canonical and gap widths', async ({ page }) => {
    for (const viewport of [...canonicalViewports, ...gapViewports]) {
        await openNotFound(page, viewport);
        const notFoundWidths = await pageWidths(page);
        expect(notFoundWidths.document).toBeLessThanOrEqual(notFoundWidths.client);
        expect(notFoundWidths.body).toBeLessThanOrEqual(notFoundWidths.client);

        await openApplicationError(page, viewport);
        const errorWidths = await pageWidths(page);
        expect(errorWidths.document).toBeLessThanOrEqual(errorWidths.client);
        expect(errorWidths.body).toBeLessThanOrEqual(errorWidths.client);
    }
});

test('system-state reveals are removed when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApplicationError(page, canonicalViewports[0]);

    const motion = await page
        .locator('[data-system-state="application-error"] > div > div:nth-child(2)')
        .evaluate((element) => {
            const style = globalThis.getComputedStyle(element);
            return {
                animationDuration: Number.parseFloat(style.animationDuration),
                animationName: style.animationName,
            };
        });
    expect(motion.animationName).toBe('none');
    expect(motion.animationDuration).toBeLessThanOrEqual(0.001);
});

for (const viewport of screenshotViewports) {
    test(`not-found matches the ${viewport.name} source-comparison capture`, async ({ page }) => {
        await openNotFound(page, viewport);
        await expect(page).toHaveScreenshot(`not-found-${viewport.name}.png`, {
            animations: 'disabled',
            caret: 'hide',
            fullPage: true,
            scale: 'css',
        });
    });

    test(`application error matches the ${viewport.name} source-comparison capture`, async ({
        page,
    }) => {
        await openApplicationError(page, viewport);
        await expect(page).toHaveScreenshot(`application-error-${viewport.name}.png`, {
            animations: 'disabled',
            caret: 'hide',
            fullPage: true,
            scale: 'css',
        });
    });
}
