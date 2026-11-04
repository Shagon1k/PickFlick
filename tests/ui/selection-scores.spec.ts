import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

for (const viewport of screenshotViewports) {
    test(
        `Selection matrix sorts names, zero, missing and tied scores at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await signInMock(context, 'valid-rating-history-imported-matrix-completed');
            await page.setViewportSize(viewport);
            await page.goto('/sessions/30000000-0000-4000-8000-000000000050', {
                waitUntil: 'load',
            });
            const table = page.getByRole('table', { name: /^Selection scores/u });
            const names = table.locator('tbody tr td:first-child');
            await expect(names).toHaveText(['Jordan', 'Casey', 'Morgan']);
            const participant = table.getByRole('columnheader', { name: /^Participant/u });
            await participant.getByRole('button').click();
            await expect(names).toHaveText(['Casey', 'Jordan', 'Morgan']);
            await expect(participant).toHaveAttribute('aria-sort', 'ascending');
            await participant.getByRole('button').click();
            await expect(names).toHaveText(['Morgan', 'Jordan', 'Casey']);
            await participant.getByRole('button').click();
            await expect(names).toHaveText(['Jordan', 'Casey', 'Morgan']);
            const selected = table.getByRole('columnheader', { name: /^Selected film/u });
            await selected.getByRole('button').click();
            await expect(names).toHaveText(['Morgan', 'Jordan', 'Casey']);
            await selected.getByRole('button').click();
            await expect(names).toHaveText(['Casey', 'Jordan', 'Morgan']);
            await selected.getByRole('button').click();
            const rival = table.getByRole('columnheader', { name: /^The rival nomination/u });
            await rival.getByRole('button').click();
            await expect(names).toHaveText(['Jordan', 'Morgan', 'Casey']);
            await rival.getByRole('button').click();
            await expect(names).toHaveText(['Jordan', 'Morgan', 'Casey']);
            await rival.getByRole('button').click();
            await expect(names).toHaveText(['Jordan', 'Casey', 'Morgan']);
            await settle(page);
            const word = rival.locator('button > span').first();
            expect(
                await word.evaluate((element) => {
                    const text = element.firstChild!;
                    const range = document.createRange();
                    range.setStart(text, element.textContent.lastIndexOf('nomination'));
                    range.setEnd(text, element.textContent.length);
                    return range.getClientRects().length;
                }),
            ).toBe(1);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        },
    );
}
