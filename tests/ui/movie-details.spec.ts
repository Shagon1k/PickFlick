import { expect, test } from '@playwright/test';

import { seedFixture } from './backend-fixture';

test('Movie details reject malformed identity without exposing provider data', async ({
    context,
    page,
}) => {
    await seedFixture(context);
    await page.goto('/movies/not-a-canonical-id');
    await expect(page.getByRole('heading', { name: 'Reel Not Found' })).toBeVisible();
});
