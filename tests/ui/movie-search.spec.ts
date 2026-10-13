import { expect, test } from '@playwright/test';

import { seedFixture } from './backend-fixture';

test(
    'Global search uses canonical catalog identity, keyboard navigation, and safe details',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await seedFixture(context);
        await page.goto('/app');
        await page.getByRole('button', { name: 'Search films' }).first().click();
        const search = page.getByRole('combobox', { name: 'Search films' });
        await search.fill('Synthetic');
        await expect(page.getByRole('option', { name: /Synthetic Movie/ })).toBeVisible();
        await search.press('ArrowDown');
        await search.press('Enter');
        await expect(page).toHaveURL(/\/movies\/[a-f0-9-]{36}$/);
        await expect(
            page.getByRole('heading', { name: 'Synthetic Movie', exact: true }),
        ).toBeVisible();
        await page.reload();
        await expect(
            page.getByRole('heading', { name: 'Synthetic Movie', exact: true }),
        ).toBeVisible();
    },
);
