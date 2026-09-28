import { expect, type Page, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports, gapViewports, screenshotViewports } from './viewports';

async function openStablePreview(page: Page, viewport: { height: number; width: number }) {
    await page.setViewportSize(viewport);
    await page.goto('/ui-preview', { waitUntil: 'load' });
    await settle(page);
}

for (const profile of [...canonicalViewports, ...gapViewports]) {
    test(
        `has no horizontal page overflow at ${profile.name}`,
        profile.width === 1024 ? { tag: '@smoke' } : {},
        async ({ page }) => {
            await openStablePreview(page, profile);

            const dimensions = await page.evaluate(() => ({
                bodyWidth: globalThis.document.body.scrollWidth,
                clientWidth: globalThis.document.documentElement.clientWidth,
                documentWidth: globalThis.document.documentElement.scrollWidth,
            }));

            expect(
                dimensions.documentWidth,
                `document overflowed at ${profile.width}px`,
            ).toBeLessThanOrEqual(dimensions.clientWidth);
            expect(
                dimensions.bodyWidth,
                `body overflowed at ${profile.width}px`,
            ).toBeLessThanOrEqual(dimensions.clientWidth);
        },
    );
}

for (const profile of screenshotViewports) {
    test(`matches the ${profile.name} visual baseline`, { tag: '@visual' }, async ({ page }) => {
        await openStablePreview(page, profile);

        await expect(page).toHaveScreenshot(`ui-preview-${profile.name}.png`, {
            animations: 'disabled',
            caret: 'hide',
            fullPage: true,
            scale: 'css',
        });
    });
}

test('collapses decorative motion when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openStablePreview(page, canonicalViewports[0]);
    await page.getByRole('button', { name: 'Open Club menu' }).click();

    const motion = await page.getByRole('menu', { name: 'Club menu' }).evaluate((element) => {
        const style = globalThis.getComputedStyle(element);
        return {
            animationDuration: Number.parseFloat(style.animationDuration),
            transitionDuration: Number.parseFloat(style.transitionDuration),
        };
    });

    expect(motion.animationDuration).toBeLessThanOrEqual(0.001);
    expect(motion.transitionDuration).toBeLessThanOrEqual(0.001);
});
