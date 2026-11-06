import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoPageOverflow } from './layout';
import { signInMock } from './mock-session';
import { settle } from './settle';
import { canonicalViewports } from './viewports';

const SESSION_ROUTE = '/sessions/30000000-0000-4000-8000-000000000050';
const HUB_ROUTE = '/clubs/10000000-0000-4000-8000-000000000031/sessions';

test(
    'Logged nominations use the shared film cards without inventing a Selection winner',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await signInMock(context, 'valid-rating-history-imported-completed');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(SESSION_ROUTE, { waitUntil: 'load' });
        const rivals = page.getByRole('region', { name: 'Nomination Rivals', exact: true });
        await expect(rivals.getByRole('list', { name: 'Logged nominations' })).toBeVisible();
        await expect(
            rivals.getByRole('link', { name: 'Selected film (2026)', exact: true }),
        ).toBeVisible();
        await expect(
            rivals.getByRole('link', { name: 'The rival nomination (2026)', exact: true }),
        ).toBeVisible();
        await expect(rivals.getByText('Watched', { exact: true })).toBeVisible();
        await expect(rivals.getByText('Winner', { exact: true })).toHaveCount(0);
        await expect(rivals.getByRole('button', { name: /Average Selection score/u })).toHaveCount(
            0,
        );
        await expect(rivals.getByText('total · 2 scores', { exact: true })).toBeVisible();
        await expect(
            page
                .getByRole('list', { name: 'Session ratings' })
                .getByRole('listitem')
                .filter({ hasText: 'Casey' }),
        ).toContainText('8.0');
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await expectNoPageOverflow(page);
    },
);

for (const viewport of canonicalViewports) {
    test(
        `Completed keeps screening facts, ratings and frozen nominations at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await signInMock(context, 'valid-rating-history-completed');
            await page.setViewportSize(viewport);
            await page.goto(SESSION_ROUTE, { waitUntil: 'load' });
            // The long synopsis puts lazy rival posters beyond the initial loading range on phones.
            await page.getByRole('heading', { name: 'Nomination Rivals' }).scrollIntoViewIfNeeded();
            await settle(page);
            await expect(
                page.getByRole('heading', { name: 'Session Details', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('region', { name: 'Session details', exact: true }),
            ).toContainText('Jordan • Casey • Morgan');
            await expect(
                page.getByRole('region', { name: 'Session details', exact: true }),
            ).toContainText('Bring snacks.');
            await expect(
                page
                    .getByRole('button', { name: 'Read the review by Casey', exact: true })
                    .getByText('A memorable screening.', { exact: true }),
            ).toBeVisible();
            const rivals = page.getByRole('region', { name: 'Nomination Rivals' });
            await expect(rivals.getByText('The rival nomination')).toBeVisible();
            const score = rivals
                .getByRole('button', { name: /^Average Selection score .* Show details$/u })
                .first();
            await score.press('Enter');
            const votes = page.getByRole('dialog').filter({ hasText: 'Top scores' });
            await expect(votes).toBeVisible();
            await expect(votes).toBeFocused();
            await page.keyboard.press('Escape');
            // Axe would otherwise measure the popover's fading text.
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Submit Rating' })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        },
    );

    test(
        `Hub separates a blocking Session, all Ratings and partial history at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await signInMock(context, 'valid-hub-history');
            await page.setViewportSize(viewport);
            await page.goto(HUB_ROUTE, { waitUntil: 'load' });
            await settle(page);
            // The blocking Session stays in the Call Sheet; only non-blocking Ratings use this list.
            await expect(page.getByRole('link', { name: /^Open Session:/u }).first()).toBeVisible();
            const active = page.getByRole('region', { name: 'Open Ratings', exact: true });
            await expect(active.getByRole('listitem')).toHaveCount(2);
            await expect(active.getByRole('progressbar', { name: '1 of 2 rated' })).toBeVisible();
            await expect(page.getByRole('link', { name: /^Open Session:/u }).first()).toContainText(
                'nomination',
            );
            const history = page.getByRole('region', { name: 'History', exact: true });
            await expect(history.getByRole('listitem').getByRole('link')).toHaveCount(2);
            await expect(
                history.getByRole('listitem').filter({ hasText: 'A completed screening' }),
            ).toContainText('8.0');
            await expect(
                history.getByRole('listitem').filter({ hasText: 'An empty screening' }),
            ).toContainText('—');
            await expectNoPageOverflow(page);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        },
    );
}

test('Completed hidden results disclose no other comments, nominees or vote totals', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-rating-history-hidden-completed');
    await page.goto(SESSION_ROUTE);
    await expect(
        page
            .getByRole('region', { name: 'Nomination Rivals', exact: true })
            .getByText('Votes are hidden for this Session.'),
    ).toBeVisible();
    await expect(page.getByText('A memorable screening.')).toHaveCount(0);
    await expect(page.getByText('The rival nomination')).toHaveCount(0);
    await expect(page.getByText(/Winner nominated by/)).toHaveCount(0);
});

test('Hub history retains Club averages when individual scores are hidden', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-hub-history-hidden');
    await page.goto(HUB_ROUTE);
    const history = page.getByRole('region', { name: 'History', exact: true });
    await expect(
        history.getByRole('listitem').filter({ hasText: 'An empty screening' }),
    ).toContainText('—');
    await expect(
        history.getByRole('listitem').filter({ hasText: 'A completed screening' }),
    ).toContainText('8.0');
});

test('Hub Sessions lists only the running Session and explains an empty history', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-hub-empty');
    await page.goto(HUB_ROUTE);
    await expect(page.getByRole('link', { name: /^Open Session:/u })).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Open Ratings', exact: true })).toHaveCount(0);
    await expect(
        page
            .getByRole('region', { name: 'History', exact: true })
            .getByText('No Session history yet.'),
    ).toBeVisible();
});
