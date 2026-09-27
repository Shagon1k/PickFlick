import type { Page } from '@playwright/test';

/**
 * Waits until the page looks final: fonts loaded, images decoded, and every finite animation (such
 * as a reveal) finished. Checks that measure layout, contrast, or pixels call this after `goto`.
 */
export async function settle(page: Page) {
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
        const finite = globalThis.document
            .getAnimations()
            .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
        await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
    });
}
