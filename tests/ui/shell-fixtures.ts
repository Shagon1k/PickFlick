import { expect, type Page } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports } from './viewports';

export const shellRoutes = [
    'public',
    'setup',
    'product',
    'session',
    'settings',
    'library',
    'admin',
] as const;
export type TPreviewShellRoute =
    | (typeof shellRoutes)[number]
    | 'session-admin'
    | 'settings-admin'
    | 'library-admin';
export async function openShell(
    page: Page,
    shell: TPreviewShellRoute,
    viewport: { height: number; width: number },
) {
    await page.setViewportSize(viewport);
    await page.goto(`/shell-preview/${shell}`, { waitUntil: 'load' });
    await settle(page);
}

export async function expectMobileAdminEntry(page: Page, shell: TPreviewShellRoute) {
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
