import type { Page, Request } from '@playwright/test';

/**
 * Waits until the page looks final: fonts loaded, rendered images decoded, and every finite
 * animation (such as a reveal) finished. Checks that measure layout, contrast, or pixels call this
 * after `goto`.
 */
export async function settle(page: Page) {
    // The pending-invites ticket slides in only after its invitations load, so it may start
    // moving after the animations below are counted: wait until it has loaded and come to rest.
    await page.waitForFunction(() => {
        const ticket = globalThis.document.querySelector('[data-invite-ticket]');
        if (!ticket) return true;
        const isShown = ticket.hasAttribute('data-shown');
        // A failed load also shows the ticket, with "—" in place of the count.
        const isLoaded =
            isShown || ticket.querySelector('[data-invite-count]')?.textContent !== '—';
        return isLoaded && (!isShown || getComputedStyle(ticket).right === '0px');
    });
    await page.evaluate(async () => {
        await globalThis.document.fonts.ready;
        // A lazy image hidden at this width (such as the Session poster) never loads, so skip it.
        await Promise.all(
            [...globalThis.document.images].map((image) =>
                image.complete || !image.checkVisibility()
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

/** Opens a route at a viewport and waits for it to settle, as layout and pixel checks need. */
export async function openAt(
    page: Page,
    route: string,
    viewport: { height: number; width: number },
) {
    await page.setViewportSize(viewport);
    await page.goto(route, { waitUntil: 'load' });
    await settle(page);
}

/**
 * Holds requests matching `url` until the returned `release` is called, so a test can look at the
 * screen mid-request. Requests that `shouldHold` rejects, such as prefetches, pass straight through.
 */
export async function holdRoute(
    page: Page,
    url: string | RegExp,
    shouldHold: (request: Request) => boolean = () => true,
) {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route(url, async (route) => {
        if (shouldHold(route.request())) await held;
        await route.continue();
    });
    return release;
}
