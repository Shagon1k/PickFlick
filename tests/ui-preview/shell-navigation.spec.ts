import { expect, test } from '@playwright/test';
import { canonicalViewports, expectMobileAdminEntry, openShell } from './shell-fixtures';

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
