import { expect, test } from '@playwright/test';

test('should serve the landing page without errors or horizontal overflow', async ({ page }) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/^PickFlick/u);
    const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
    expect(browserErrors).toEqual([]);
});
