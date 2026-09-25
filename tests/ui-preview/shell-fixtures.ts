import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
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
export type PreviewShellRoute =
    | (typeof shellRoutes)[number]
    | 'session-admin'
    | 'settings-admin'
    | 'library-admin';
export async function openShell(
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

export function formatViolations(
    violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
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

export async function expectMobileAdminEntry(page: Page, shell: PreviewShellRoute) {
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
