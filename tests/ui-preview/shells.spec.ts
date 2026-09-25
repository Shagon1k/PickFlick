import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const shellRoutes = [
    'public',
    'setup',
    'product',
    'session',
    'settings',
    'library',
    'admin',
] as const;
type PreviewShellRoute =
    | (typeof shellRoutes)[number]
    | 'session-admin'
    | 'settings-admin'
    | 'library-admin';
const canonicalViewports = [
    { height: 844, name: 's-390', width: 390 },
    { height: 1024, name: 'm-768', width: 768 },
    { height: 768, name: 'l-1024', width: 1024 },
    { height: 900, name: 'xl-1440', width: 1440 },
] as const;
const gapViewports = [
    { height: 900, name: 's-to-m-640', width: 640 },
    { height: 900, name: 'm-to-l-900', width: 900 },
    { height: 900, name: 'l-to-xl-1200', width: 1200 },
] as const;

async function openShell(
    page: Page,
    shell: PreviewShellRoute,
    viewport: { height: number; width: number },
) {
    await page.setViewportSize(viewport);
    await page.goto(`/shell-preview/${shell}`, { waitUntil: 'networkidle' });
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

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
    return violations
        .map(
            (violation) =>
                `${violation.id}: ${violation.help}\n${violation.nodes
                    .map(
                        (node) => `  ${node.target.join(' ')}: ${node.failureSummary ?? node.html}`,
                    )
                    .join('\n')}`,
        )
        .join('\n');
}

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

test('mobile product menus stay in view, dismiss outside, and share the Alerts overlay', async ({
    page,
}) => {
    await openShell(page, 'product', canonicalViewports[0]);

    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile product navigation' });
    const hubTrigger = mobileNavigation.getByRole('button', { name: 'Overview' });
    const libraryTrigger = mobileNavigation.getByRole('button', { name: 'My Library' });
    const alertsTrigger = mobileNavigation.getByRole('button', { name: 'Alerts' });
    const settingsTrigger = mobileNavigation.getByRole('button', { name: 'Settings' });
    const mobileNotifications = page.locator('#shell-notifications-mobile');
    await hubTrigger.click();
    await expect(page.getByRole('navigation', { name: 'Hub sections' })).toBeVisible();
    await expect(
        page
            .getByRole('navigation', { name: 'Hub sections' })
            .getByRole('link', { name: 'Overview' }),
    ).toBeFocused();

    const hubMenu = page.locator('[data-anchored-menu=hub]');
    await hubMenu.evaluate(async (element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    const hubBox = await hubMenu.boundingBox();
    expect(hubBox?.x).toBeGreaterThanOrEqual(0);
    expect((hubBox?.x ?? 0) + (hubBox?.width ?? 0)).toBeLessThanOrEqual(
        canonicalViewports[0].width,
    );
    const hubTail = await hubMenu.locator(':scope > [aria-hidden=true]').boundingBox();
    expect(
        Math.abs(
            (hubTail?.x ?? 0) +
                (hubTail?.width ?? 0) / 2 -
                ((hubBox?.x ?? 0) + (hubBox?.width ?? 0) / 2),
        ),
    ).toBeLessThanOrEqual(1);

    await page.getByRole('heading', { name: 'Club context' }).click();
    await expect(page.getByRole('navigation', { name: 'Hub sections' })).toBeHidden();

    await libraryTrigger.click();
    await expect(page.getByRole('navigation', { name: 'My Library sections' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Ratings' })).toBeFocused();

    await alertsTrigger.click();
    await expect(page.getByRole('navigation', { name: 'My Library sections' })).toBeHidden();
    await expect(mobileNotifications).toBeVisible();
    await expect(mobileNotifications).toBeFocused();
    expect((await mobileNotifications.boundingBox())?.y).toBeLessThan(
        (await alertsTrigger.boundingBox())?.y ?? 0,
    );

    await settingsTrigger.click();
    await expect(mobileNotifications).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Settings sections' })).toBeVisible();
    const settingsMenu = page.locator('[data-anchored-menu=settings]');
    await settingsMenu.evaluate(async (element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    const settingsBox = await settingsMenu.boundingBox();
    expect(settingsBox?.x).toBeGreaterThanOrEqual(0);
    expect((settingsBox?.x ?? 0) + (settingsBox?.width ?? 0)).toBeLessThanOrEqual(
        canonicalViewports[0].width,
    );

    await page.keyboard.press('Escape');
    await expect(settingsTrigger).toBeFocused();

    const triggers = mobileNavigation.locator('button[data-product-overlay-control]');
    await expect(triggers).toHaveCount(4);
    for (const control of await triggers.all()) {
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    const mobileIcons = await triggers
        .locator('svg')
        .evaluateAll((icons) => icons.map((icon) => icon.innerHTML));
    expect(new Set(mobileIcons).size).toBe(mobileIcons.length);
});

test('mobile product menus remain scrollable in a short landscape viewport', async ({ page }) => {
    const landscapeViewport = { height: 390, width: 844 };
    await openShell(page, 'settings', landscapeViewport);

    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile product navigation' });
    await mobileNavigation.getByRole('button', { name: 'Settings' }).click();
    const menu = page.locator('[data-anchored-menu=settings]');
    await menu.evaluate(async (element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    const menuBox = await menu.boundingBox();
    const dimensions = await page
        .getByRole('navigation', { name: 'Settings sections' })
        .evaluate((element) => ({
            clientHeight: element.clientHeight,
            overflowY: globalThis.getComputedStyle(element).overflowY,
            scrollHeight: element.scrollHeight,
        }));
    expect(menuBox?.y).toBeGreaterThanOrEqual(0);
    expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(
        landscapeViewport.height,
    );
    expect(dimensions.overflowY).toBe('auto');
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    const signOut = page
        .getByRole('navigation', { name: 'Settings sections' })
        .getByRole('button', { name: 'Sign out' });
    await signOut.scrollIntoViewIfNeeded();
    await expect(signOut).toBeInViewport();
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

test('Library and Settings menus expose distinct subsection destinations', async ({ page }) => {
    await openShell(page, 'product', canonicalViewports[0]);
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile product navigation' });

    await mobileNavigation.getByRole('button', { name: 'My Library' }).click();
    const libraryLinks = page
        .getByRole('navigation', { name: 'My Library sections' })
        .getByRole('link');
    await expect(libraryLinks).toHaveCount(3);
    expect(
        new Set(
            await libraryLinks.evaluateAll((links) =>
                links.map((link) => link.getAttribute('href')),
            ),
        ).size,
    ).toBe(3);

    await mobileNavigation.getByRole('button', { name: 'Settings' }).click();
    const settingsNavigation = page.getByRole('navigation', { name: 'Settings sections' });
    const settingsLinks = settingsNavigation.getByRole('link');
    await expect(settingsLinks).toHaveText([
        'Admin Panel',
        'Profile',
        'Notifications',
        'Subscription',
        'Privacy & data',
    ]);
    expect(
        new Set(
            await settingsLinks.evaluateAll((links) =>
                links.map((link) => link.getAttribute('href')),
            ),
        ).size,
    ).toBe(5);
    await expect(settingsNavigation.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(settingsNavigation.getByRole('link', { name: 'Subscription' })).toHaveAttribute(
        'href',
        '/shell-preview/settings?tab=subscription',
    );
    await expect(settingsNavigation.getByRole('link', { name: 'Privacy & data' })).toHaveAttribute(
        'href',
        '/shell-preview/settings?tab=privacy',
    );
});

test('Club and Admin section navigation exposes distinct destinations and current state', async ({
    page,
}) => {
    await openShell(page, 'product', canonicalViewports[2]);
    const clubNavigation = page.getByRole('navigation', { name: 'Club sections' });
    const clubLinks = clubNavigation.getByRole('link');
    await expect(clubLinks).toHaveCount(6);
    expect(
        new Set(
            await clubLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        ).size,
    ).toBe(6);
    await expect(clubNavigation.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'aria-current',
        'page',
    );

    await openShell(page, 'product', canonicalViewports[0]);
    const hubTrigger = page
        .getByRole('navigation', { name: 'Mobile product navigation' })
        .getByRole('button', { name: 'Overview' });
    await hubTrigger.click();
    const hubLinks = page.getByRole('navigation', { name: 'Hub sections' }).getByRole('link');
    await expect(hubLinks).toHaveText([
        'Overview',
        'Sessions',
        'Ratings',
        'Members',
        'Achievements',
        'Manage Club',
    ]);
    await expect(hubLinks.first()).toHaveAttribute('aria-current', 'page');

    await openShell(page, 'admin', canonicalViewports[2]);
    const adminNavigation = page
        .getByRole('complementary', { name: 'Admin sections' })
        .getByRole('navigation');
    const adminLinks = adminNavigation.getByRole('link');
    await expect(adminLinks).toHaveCount(4);
    expect(
        new Set(
            await adminLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        ).size,
    ).toBe(4);
    await expect(adminNavigation.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'aria-current',
        'page',
    );

    await openShell(page, 'admin', canonicalViewports[0]);
    await page.getByRole('button', { name: /Admin sections Overview/ }).click();
    const mobileAdminLinks = page
        .getByRole('navigation', { name: 'Admin sections mobile' })
        .getByRole('link');
    await expect(mobileAdminLinks).toHaveCount(4);
    expect(
        new Set(
            await mobileAdminLinks.evaluateAll((links) =>
                links.map((link) => link.getAttribute('href')),
            ),
        ).size,
    ).toBe(4);
});

async function expectMobileAdminEntry(page: Page, shell: PreviewShellRoute) {
    await openShell(page, shell, canonicalViewports[0]);
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile product navigation' });
    await expect(mobileNavigation.getByRole('button', { name: 'Admin' })).toHaveCount(0);
    await mobileNavigation.getByRole('button', { name: 'Settings' }).click();
    await expect(
        page
            .getByRole('navigation', { name: 'Settings sections' })
            .getByRole('link', { name: 'Admin Panel' }),
    ).toHaveAttribute('href', '/shell-preview/admin');
}

test('App Admin capability is preserved on admin and non-admin shells', async ({ page }) => {
    await openShell(page, 'session', canonicalViewports[2]);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(
        page
            .getByRole('navigation', { name: 'Account navigation' })
            .getByRole('link', { name: 'Admin Panel' }),
    ).toHaveCount(0);

    await openShell(page, 'product', canonicalViewports[2]);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(
        page
            .getByRole('navigation', { name: 'Account navigation' })
            .getByRole('link', { name: 'Admin Panel' }),
    ).toBeVisible();

    await expectMobileAdminEntry(page, 'product');
    await openShell(page, 'admin', canonicalViewports[0]);
    await page
        .getByRole('navigation', { name: 'Mobile product navigation' })
        .getByRole('button', { name: 'Settings' })
        .click();
    await expect(
        page
            .getByRole('navigation', { name: 'Settings sections' })
            .getByRole('link', { name: 'Admin Panel' }),
    ).toHaveAttribute('aria-current', 'page');

    for (const shell of ['session', 'settings', 'library'] as const) {
        await openShell(page, `${shell}-admin`, canonicalViewports[2]);
        await page.getByRole('button', { name: 'Account menu' }).click();
        await expect(
            page
                .getByRole('navigation', { name: 'Account navigation' })
                .getByRole('link', { name: 'Admin Panel' }),
        ).toBeVisible();

        await expectMobileAdminEntry(page, `${shell}-admin`);
    }

    await openShell(page, 'session', canonicalViewports[0]);
    await page
        .getByRole('navigation', { name: 'Mobile product navigation' })
        .getByRole('button', { name: 'Settings' })
        .click();
    await expect(
        page
            .getByRole('navigation', { name: 'Settings sections' })
            .getByRole('link', { name: 'Admin Panel' }),
    ).toHaveCount(0);
});

test('authenticated shells expose Sign out as an action on desktop and mobile', async ({
    page,
}) => {
    await openShell(page, 'product', canonicalViewports[2]);
    await page.getByRole('button', { name: 'Account menu' }).click();
    const desktopAction = page
        .getByRole('navigation', { name: 'Account navigation' })
        .getByRole('button', { name: 'Sign out' });
    await expect(desktopAction).toHaveAttribute('data-shell-action', 'sign-out');

    await openShell(page, 'settings', canonicalViewports[0]);
    await page
        .getByRole('navigation', { name: 'Mobile product navigation' })
        .getByRole('button', { name: 'Settings' })
        .click();
    const mobileAction = page
        .getByRole('navigation', { name: 'Settings sections' })
        .getByRole('button', { name: 'Sign out' });
    await expect(mobileAction).toHaveAttribute('data-shell-action', 'sign-out');
});

test('Sign out revokes the browser session before returning to Login', async ({ page }) => {
    let signOutMethod = '';
    await page.route('**/api/auth/sign-out', async (route) => {
        signOutMethod = route.request().method();
        await route.fulfill({
            contentType: 'application/json',
            json: { success: true },
            status: 200,
        });
    });

    await openShell(page, 'product', canonicalViewports[2]);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page
        .getByRole('navigation', { name: 'Account navigation' })
        .getByRole('button', { name: 'Sign out' })
        .click();

    await expect(page).toHaveURL(/\/login$/);
    expect(signOutMethod).toBe('POST');
});

test('a failed Sign out keeps the session UI and shows a visible error', async ({ page }) => {
    await page.route('**/api/auth/sign-out', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            json: { message: 'failed' },
            status: 500,
        });
    });

    await openShell(page, 'product', canonicalViewports[2]);
    await page.getByRole('button', { name: 'Account menu' }).click();
    const accountNavigation = page.getByRole('navigation', { name: 'Account navigation' });
    const signOut = accountNavigation.getByRole('button', { name: 'Sign out' });
    await signOut.click();

    await expect(accountNavigation.getByRole('alert')).toHaveText(
        'Sign out failed. Please try again.',
    );
    await expect(accountNavigation.getByRole('alert')).toBeVisible();
    await expect(signOut).toBeEnabled();
    await expect(page).toHaveURL(/\/shell-preview\/product$/);
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

test('section mobile menus focus their first item and return focus', async ({ page }) => {
    await openShell(page, 'settings', canonicalViewports[0]);
    const sectionTrigger = page.getByRole('button', { name: /Settings sections Profile/ });
    await sectionTrigger.click();
    await expect(
        page
            .getByRole('navigation', { name: 'Settings sections mobile' })
            .getByRole('link')
            .first(),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sectionTrigger).toBeFocused();
});

test('section menus share the product overlay state', async ({ page }) => {
    await openShell(page, 'settings', canonicalViewports[0]);
    const sectionTrigger = page.getByRole('button', { name: /Settings sections Profile/ });
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile product navigation' });

    await sectionTrigger.click();
    await expect(page.getByRole('navigation', { name: 'Settings sections mobile' })).toBeVisible();
    await mobileNavigation.getByRole('button', { name: 'Alerts' }).click();
    await expect(page.getByRole('navigation', { name: 'Settings sections mobile' })).toHaveCount(0);
    await expect(page.locator('#shell-notifications-mobile')).toBeVisible();

    await sectionTrigger.click();
    await expect(page.locator('#shell-notifications-mobile')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Settings sections mobile' })).toBeVisible();
    await mobileNavigation.getByRole('button', { name: 'My Library' }).click();
    await expect(page.getByRole('navigation', { name: 'Settings sections mobile' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'My Library sections' })).toBeVisible();
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
