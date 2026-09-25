import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
    shellRoutes,
    canonicalViewports,
    gapViewports,
    openShell,
    formatViolations,
} from './shell-fixtures';

for (const shell of shellRoutes) {
    test(`${shell} shell has no automated accessibility violations`, async ({ page }) => {
        for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
            await openShell(page, shell, viewport);
            const results = await new AxeBuilder({ page }).analyze();
            expect(
                results.violations,
                `${shell} at ${viewport.name}\n${formatViolations(results.violations)}`,
            ).toEqual([]);
        }
    });

    test(`${shell} shell contains page overflow across canonical and gap widths`, async ({
        page,
    }) => {
        for (const viewport of [...canonicalViewports, ...gapViewports]) {
            await openShell(page, shell, viewport);
            const dimensions = await page.evaluate(() => ({
                body: globalThis.document.body.scrollWidth,
                client: globalThis.document.documentElement.clientWidth,
                document: globalThis.document.documentElement.scrollWidth,
            }));
            expect(
                dimensions.document,
                `${shell} document at ${viewport.width}px`,
            ).toBeLessThanOrEqual(dimensions.client);
            expect(dimensions.body, `${shell} body at ${viewport.width}px`).toBeLessThanOrEqual(
                dimensions.client,
            );
        }
    });

    for (const viewport of canonicalViewports) {
        test(`${shell} shell matches the ${viewport.name} source-comparison capture`, async ({
            page,
        }) => {
            await openShell(page, shell, viewport);
            await expect(page).toHaveScreenshot(`shell-${shell}-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                scale: 'css',
            });
        });
    }
}

test('header overlays are mutually exclusive and return focus', async ({ page }) => {
    await openShell(page, 'product', canonicalViewports[2]);

    const searchTrigger = page.getByRole('button', { name: 'Search films' });
    const notificationsTrigger = page.getByRole('button', { name: 'Notifications' });
    const searchOverlay = page.locator('#shell-search');
    const notifications = page.locator('#shell-notifications');
    await searchTrigger.click();
    await expect(searchOverlay).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search films' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Close search' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('searchbox', { name: 'Search films' })).toBeFocused();
    await page.getByRole('searchbox', { name: 'Search films' }).fill('Dune');
    await expect(searchOverlay.getByRole('status')).toHaveText('Film search isn’t available yet.');
    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(searchTrigger).toBeFocused();
    await expect(
        page.getByRole('searchbox', { name: 'Search films', includeHidden: true }),
    ).toHaveValue('');

    await notificationsTrigger.click();
    await expect(searchOverlay).toBeHidden();
    await expect(notifications).toBeVisible();
    await expect(notifications).toBeFocused();
    await expect(notifications.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(notifications.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
    await page.keyboard.press('Tab');
    await expect(notifications).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(notifications).toBeHidden();
    await expect(notificationsTrigger).toBeFocused();

    const accountTrigger = page.getByRole('button', { name: 'Account menu' });
    await accountTrigger.click();
    const accountNavigation = page.getByRole('navigation', { name: 'Account navigation' });
    const firstAccountItem = accountNavigation.getByRole('link', { name: 'Admin Panel' });
    const lastAccountItem = accountNavigation.getByRole('button', { name: 'Sign out' });
    await expect(firstAccountItem).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(lastAccountItem).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstAccountItem).toBeFocused();

    const accountMenu = page.locator('#shell-account-menu');
    await accountMenu.evaluate(async (element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    const accountBox = await accountMenu.boundingBox();
    const accountTriggerBox = await accountTrigger.boundingBox();
    expect(accountBox?.y).toBeGreaterThan(accountTriggerBox?.y ?? 0);
    expect((accountBox?.x ?? 0) + (accountBox?.width ?? 0)).toBeLessThanOrEqual(
        canonicalViewports[2].width,
    );
    const accountTail = await accountMenu.locator(':scope > [aria-hidden=true]').boundingBox();
    const center = (box: { x: number; width: number } | null) =>
        (box?.x ?? 0) + (box?.width ?? 0) / 2;
    expect(Math.abs(center(accountTail) - center(accountBox))).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(accountTrigger).toBeFocused();

    await searchTrigger.click();
    await searchOverlay.evaluate(async (element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    const searchBox = await searchOverlay.boundingBox();
    expect(searchBox?.x).toBe(0);
    expect(searchBox?.y).toBe(0);
    expect(searchBox?.width).toBe(canonicalViewports[2].width);
});

test('public legal links use distinct canonical destinations', async ({ page }) => {
    await openShell(page, 'public', canonicalViewports[2]);
    await expect(
        page
            .getByRole('navigation', { exact: true, name: 'Public navigation' })
            .getByRole('link', { name: 'How it works' }),
    ).toHaveAttribute('href', '/shell-preview/public#public-content');
    const footer = page.getByRole('navigation', { name: 'Footer navigation' });
    await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
        'href',
        '/legal/privacy',
    );
    await expect(footer.getByRole('link', { name: 'Terms' })).toHaveAttribute(
        'href',
        '/legal/terms',
    );
});

test('product primary action opens the Session destination', async ({ page }) => {
    await openShell(page, 'product', canonicalViewports[2]);
    const primaryAction = page.getByRole('link', { name: 'Primary action' });
    await expect(primaryAction).toHaveAttribute('href', '/shell-preview/session');
    await primaryAction.click();
    await expect(page).toHaveURL(/\/shell-preview\/session$/);
    await expect(page.getByRole('heading', { name: 'Film and Session context' })).toBeVisible();
});

test('compact and Session headers match their canonical navigation variants', async ({ page }) => {
    await openShell(page, 'product', canonicalViewports[1]);
    await expect(
        page.getByRole('navigation', { exact: true, name: 'Product navigation' }),
    ).toBeHidden();
    const compactHeader = page.locator('header');
    await expect(compactHeader.getByRole('button', { name: 'Notifications' })).toBeHidden();
    await expect(compactHeader.getByRole('button', { name: 'Account menu' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'PickFlick home' })).toContainText('PickFlick');

    await openShell(page, 'session', canonicalViewports[2]);
    await expect(
        page.getByRole('navigation', { exact: true, name: 'Product navigation' }).getByRole('link'),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to Hub' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Back to Hub' })).toHaveAttribute(
        'href',
        '/shell-preview/product',
    );
});

test('visible shell controls keep 44px targets and a visible keyboard focus', async ({ page }) => {
    for (const shell of shellRoutes) {
        await openShell(page, shell, canonicalViewports[0]);
        const controls = page.locator('a[href]:visible, button:visible, input:visible');
        for (const control of await controls.all()) {
            const box = await control.boundingBox();
            expect(
                box?.height,
                `${shell}: ${await control.evaluate((element) => element.outerHTML)}`,
            ).toBeGreaterThanOrEqual(44);
        }
    }

    await openShell(page, 'public', canonicalViewports[0]);
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    const focusTreatment = await focused.evaluate((element) => {
        const style = globalThis.getComputedStyle(element);
        return {
            boxShadow: style.boxShadow,
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
        };
    });
    expect(
        focusTreatment.boxShadow !== 'none' ||
            (focusTreatment.outlineStyle !== 'none' && focusTreatment.outlineWidth !== '0px'),
    ).toBe(true);
});

test('dense regions scroll locally without widening the page', async ({ page }) => {
    for (const shell of ['library', 'admin'] as const) {
        await openShell(page, shell, canonicalViewports[0]);
        const region = page.getByRole('region', {
            name:
                shell === 'library' ? 'Library results preview' : 'Administration results preview',
        });
        const widths = await region.evaluate((element) => ({
            client: element.clientWidth,
            scroll: element.scrollWidth,
        }));
        expect(widths.scroll).toBeGreaterThan(widths.client);
        await region.focus();
        await page.keyboard.press('ArrowRight');
        expect(await region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    }
});

test('shell motion collapses under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openShell(page, 'product', canonicalViewports[0]);
    const longestTransition = (element: Element) =>
        Math.max(
            ...globalThis
                .getComputedStyle(element)
                .transitionDuration.split(',')
                .map((value) => Number.parseFloat(value)),
        );

    await page
        .getByRole('navigation', { name: 'Mobile product navigation' })
        .getByRole('button', { name: 'Overview' })
        .click();
    expect(
        await page.locator('[data-anchored-menu=hub]').evaluate(longestTransition),
    ).toBeLessThanOrEqual(0.001);

    await page.getByRole('button', { name: 'Search films' }).click();
    expect(await page.locator('#shell-search').evaluate(longestTransition)).toBeLessThanOrEqual(
        0.001,
    );
});
