import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { canonicalViewports } from './viewports';

const clubId = '10000000-0000-4000-8000-000000000031';
const route = `/clubs/${clubId}/sessions/new`;
async function authenticate(context: BrowserContext, token: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `${token}-${crypto.randomUUID()}`,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

test(
    'Session creation, editing, cancellation and Hub projection',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-session-workflow-full');
        await page.goto(`/clubs/${clubId}`);
        await page.getByRole('link', { name: 'Create Session', exact: true }).click();
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await expect(page.getByLabel('Date')).toBeFocused();
        await page.getByLabel('Date').fill('2026-12-01');
        await page.getByLabel('Location').fill('Room A');
        await page.getByLabel('Topic').fill('Noir night');
        await page.getByLabel('Nomination phase ends in').fill('01:30');
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await expect(page.getByText('Session created. Nomination is open.')).toBeVisible();
        await page.goBack();
        await expect(page.getByRole('link', { name: 'Create Session', exact: true })).toHaveCount(
            0,
        );
        await page.getByRole('link', { name: 'Noir night', exact: true }).first().click();
        await expect(page.getByRole('heading', { name: 'Noir night', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Edit Session' }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Edit Session' })).toBeFocused();
        await page.getByRole('button', { name: 'Edit Session' }).click();
        await page.getByRole('dialog').getByLabel('Location').fill('Room B');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByText('Room B', { exact: true })).toBeVisible();
        await page.goBack();
        await expect(page.getByText('Room B', { exact: true })).toBeVisible();
        await expect(page.getByText('Room A', { exact: true })).toHaveCount(0);
        await page.getByRole('link', { name: 'Noir night', exact: true }).first().click();
        await page.getByRole('button', { name: 'Cancel Session', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled();
        await page.getByLabel('Type CANCEL to confirm').fill('CANCEL');
        await page.getByRole('button', { name: 'Confirm cancellation' }).click();
        await expect(
            page.getByText('This Session was cancelled. Its history is preserved.'),
        ).toBeVisible();
        await page.getByRole('link', { name: '← Midnight Society' }).click();
        await expect(page.getByRole('heading', { name: 'Session history' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Noir night' }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'Create Session', exact: true })).toBeVisible();
    },
);

test(
    'Pre-selected Movie uses keyboard search and enters Watching',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-session-workflow-preselected');
        await page.goto(route);
        await page.getByLabel('Date').fill('2026-12-01');
        await page.getByLabel('Location').fill('Room A');
        await page.getByRole('radio', { name: 'Pre-selected Movie' }).check();
        await expect(page.getByLabel('Nomination phase ends in')).toHaveCount(0);
        const search = page.getByRole('combobox', { name: 'Select a Movie' });
        await search.fill('film');
        await expect(page.getByRole('option')).toHaveCount(2);
        await search.press('ArrowDown');
        await search.press('Enter');
        await expect(search).toHaveValue('<script>alert(1)</script> & Film');
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await expect(
            page.getByText('Session created. Your Movie is ready for Watching.'),
        ).toBeVisible();
        await page.getByRole('link', { name: 'Open Session' }).click();
        await expect(page.getByText('watching', { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'View selected Movie' })).toHaveAttribute(
            'href',
            '/movies/10000000-0000-4000-8000-000000000037',
        );
    },
);

test('Session save failure keeps entries and offline submit explains recovery', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-session-workflow-failure');
    await page.goto(route);
    await page.getByLabel('Date').fill('2026-12-01');
    await page.getByLabel('Location').fill('Room A');
    await page.getByLabel('Topic').fill('API failure');
    await page.getByRole('button', { name: 'Create Session', exact: true }).click();
    await expect(
        page.getByText('We could not save your Session. Your entries are still here; try again.'),
    ).toBeVisible();
    await expect(page.getByLabel('Location')).toHaveValue('Room A');
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Create Session', exact: true }).click();
    await expect(
        page.getByText(
            'You appear to be offline. Reconnect, then try again; your entries are still here.',
        ),
    ).toBeVisible();
});

for (const viewport of canonicalViewports) {
    test(`Create Session accessibility and responsive composition at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await authenticate(context, `valid-session-workflow-${viewport.name}`);
        await page.setViewportSize(viewport);
        await page.goto(route, { waitUntil: 'load' });
        await settle(page);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
            path: `test-results/session-create-${viewport.name}.png`,
            fullPage: true,
        });
        await page.getByLabel('Date').fill('2026-12-01');
        await page.getByLabel('Location').fill('Room A');
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await page.getByRole('link', { name: 'Open Session' }).click();
        await settle(page);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
            path: `test-results/session-detail-${viewport.name}.png`,
            fullPage: true,
        });
    });
}

test('Members and archived Clubs have no create form', async ({ context, page }) => {
    await authenticate(context, 'valid-session-workflow-member');
    await page.goto(route);
    await expect(
        page.getByText('You cannot create a Session in this Club right now.'),
    ).toBeVisible();
    await expect(page.getByLabel('Location')).toHaveCount(0);
    await authenticate(context, 'valid-session-workflow-archived');
    await page.goto(route);
    await expect(
        page.getByText('You cannot create a Session in this Club right now.'),
    ).toBeVisible();
});
