import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports } from './viewports';

const path = '/sessions/30000000-0000-4000-8000-000000000042';
async function authenticate(context: BrowserContext, scenario = '', token?: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: token ?? `valid-nomination-${scenario}-${crypto.randomUUID()}`,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

test(
    'Personal suggestion uses the submission flow and locks the confirmed Movie',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'hidden-anonymous');
        await page.goto(path);
        await expect(
            page.getByText('Nominations are hidden until you submit your own Movie.'),
        ).toBeVisible();
        await expect(page.getByText('Current private film')).toHaveCount(0);
        await page.getByRole('button', { name: 'Past losing nomination (2020)' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText('Selected: Past losing nomination (2020)')).toBeVisible();
        await page.getByRole('button', { name: 'Nominate This' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText('Your nomination is confirmed.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Nominate This' })).toHaveCount(0);
        await expect(page.getByText('2 of 3 participants have nominated.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Find & Nominate a Movie' })).toBeFocused();
        await page.getByRole('button', { name: 'Refresh nominations' }).click();
        await expect(page.getByText('Nominations refreshed.')).toBeVisible();
        await expect(page.getByText('by Jordan Member')).toHaveCount(0);
    },
);

test('Search selection and failure/offline states retain the selected Movie', async ({
    context,
    page,
}) => {
    await authenticate(context, 'failure');
    await page.goto(path);
    const search = page.getByRole('combobox', { name: 'Select a Movie' });
    await search.fill('Dune');
    await expect(page.getByRole('option').first()).toBeVisible();
    await search.press('ArrowDown');
    await search.press('Enter');
    await page.getByRole('button', { name: 'Nominate This' }).click();
    await expect(
        page.getByText('We could not save this action. Your selection is still here; try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove selected Movie' })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Nominate This' }).click();
    await expect(
        page.getByText(
            'You appear to be offline. Reconnect before continuing; your selection is still here.',
        ),
    ).toBeVisible();
});

test('Operator early close traps and returns focus and requires confirmation', async ({
    context,
    page,
}) => {
    await authenticate(context, 'operator');
    await page.goto(path);
    const close = page.getByRole('button', { name: 'Close nominations early' });
    await close.click();
    await expect(page.getByRole('button', { name: 'Confirm close' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(close).toBeFocused();
    await close.click();
    await page.getByLabel('Type CLOSE to confirm').fill('CLOSE');
    await page.getByRole('button', { name: 'Confirm close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('selection', { exact: true })).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Nomination night', exact: true }),
    ).toBeFocused();
});

for (const viewport of canonicalViewports) {
    test(`Nomination accessibility and local carousel at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await authenticate(context);
        await page.setViewportSize(viewport);
        await page.goto(path, { waitUntil: 'load' });
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.screenshot({ path: test.info().outputPath('nomination.png'), fullPage: true });
    });
}

test(
    'Two clients ignore stale versions, refresh live progress and recover after an offline phase change',
    { tag: '@smoke' },
    async ({ browser }) => {
        const actor = await browser.newContext();
        const viewer = await browser.newContext();
        const token = `valid-nomination-operator-live-${crypto.randomUUID()}`;
        await authenticate(actor, '', token);
        await authenticate(viewer, '', token);
        const actorPage = await actor.newPage();
        const viewerPage = await viewer.newPage();
        try {
            await Promise.all([actorPage.goto(path), viewerPage.goto(path)]);
            await expect(viewerPage.getByText('1 of 3 participants have nominated.')).toBeVisible();
            await actorPage.getByRole('button', { name: 'Past losing nomination (2020)' }).click();
            await actorPage.getByRole('button', { name: 'Nominate This' }).click();
            await expect(viewerPage.getByText('2 of 3 participants have nominated.')).toBeVisible();
            await viewer.setOffline(true);
            await actorPage.getByRole('button', { name: 'Close nominations early' }).click();
            await actorPage.getByLabel('Type CLOSE to confirm').fill('CLOSE');
            await actorPage.getByRole('button', { name: 'Confirm close' }).click();
            await expect(actorPage.getByText('selection', { exact: true })).toBeVisible();
            await viewer.setOffline(false);
            await expect(viewerPage.getByText('selection', { exact: true })).toBeVisible();
        } finally {
            await actor.close();
            await viewer.close();
        }
    },
);

test('Progress polling shows another participant nomination', async ({ browser }) => {
    const actor = await browser.newContext();
    const viewer = await browser.newContext();
    const token = `valid-nomination-live-${crypto.randomUUID()}`;
    await authenticate(actor, '', token);
    await authenticate(viewer, '', token);
    const actorPage = await actor.newPage();
    const viewerPage = await viewer.newPage();
    try {
        await Promise.all([actorPage.goto(path), viewerPage.goto(path)]);
        await actorPage.getByRole('button', { name: 'Past losing nomination (2020)' }).click();
        await actorPage.getByRole('button', { name: 'Nominate This' }).click();
        await expect(viewerPage.getByText('2 of 3 participants have nominated.')).toBeVisible({
            timeout: 20000,
        });
    } finally {
        await actor.close();
        await viewer.close();
    }
});

for (const projection of ['detail', 'roster']) {
    test(
        `Live progress recovers after a failed authoritative ${projection} refresh`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const actor = await browser.newContext();
            const viewer = await browser.newContext();
            const token = `valid-nomination-refresh-${projection}-${crypto.randomUUID()}`;
            await authenticate(actor, '', token);
            await authenticate(viewer, '', token);
            const actorPage = await actor.newPage();
            const viewerPage = await viewer.newPage();
            try {
                await Promise.all([actorPage.goto(path), viewerPage.goto(path)]);
                await expect(
                    viewerPage.getByText('1 of 3 participants have nominated.'),
                ).toBeVisible();
                await actorPage
                    .getByRole('button', { name: 'Past losing nomination (2020)' })
                    .click();
                await actorPage.getByRole('button', { name: 'Nominate This' }).click();
                await expect(
                    viewerPage.getByRole('heading', { name: 'Session unavailable' }),
                ).toBeVisible();
                // Recovery waits for the failure window and one or two progress polls.
                await expect(
                    viewerPage.getByText('2 of 3 participants have nominated.'),
                ).toBeVisible({ timeout: 20000 });
                await expect(
                    viewerPage.getByRole('heading', { name: 'Session unavailable' }),
                ).toHaveCount(0);
            } finally {
                await actor.close();
                await viewer.close();
            }
        },
    );
}

test(
    'A departure between roster and detail reads recovers at the unchanged detail version',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'split-roster');
        await page.goto(path);
        await expect(page.getByText('3 accepted', { exact: true })).toBeVisible();
        await expect(page.getByText('1 of 2 participants have nominated.')).toBeVisible();
        await expect(page.getByText('2 accepted', { exact: true })).toBeVisible();
        await expect(page.getByText('Jordan', { exact: true })).toHaveCount(0);
    },
);
