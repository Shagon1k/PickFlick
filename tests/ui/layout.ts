import { expect, type Page } from '@playwright/test';

/** Fails when the document or body is wider than the viewport, which would scroll sideways. */
export async function expectNoPageOverflow(page: Page, label?: string) {
    const widths = await page.evaluate(() => ({
        body: globalThis.document.body.scrollWidth,
        client: globalThis.document.documentElement.clientWidth,
        document: globalThis.document.documentElement.scrollWidth,
    }));
    expect(widths.document, label).toBeLessThanOrEqual(widths.client);
    expect(widths.body, label).toBeLessThanOrEqual(widths.client);
}
