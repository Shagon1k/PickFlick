import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';
import { canonicalViewports, screenshotViewports } from './viewports';

const CLUB_ID = '10000000-0000-4000-8000-000000000031';
const ROUTE = `/clubs/${CLUB_ID}/sessions/new`;
async function authenticate(context: BrowserContext, token: string) {
    await signInMock(context, `${token}-${crypto.randomUUID()}`);
}

test(
    'Session creation, editing, cancellation and Hub projection',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-session-workflow-full');
        await page.goto(`/clubs/${CLUB_ID}`);
        await expect(page.getByRole('link', { name: /^Open Session:/u })).toHaveCount(0);
        await expect(
            page
                .getByRole('region', { name: 'Active Session', exact: true })
                .getByRole('link', { name: 'Open Session', exact: true }),
        ).toHaveCount(0);
        await page.getByRole('link', { name: 'Create Session', exact: true }).click();
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await expect(page.getByLabel('Date')).toBeFocused();
        await page.getByLabel('Date').fill('2090-12-01');
        await page.getByLabel('Location').fill('Room A');
        await page.getByLabel('Topic').fill('Noir night');
        await page.getByLabel('Nomination phase ends in').fill('01:30');
        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
        await expect(page.getByText('Session created. Nomination is open.')).toBeVisible();
        await page.goBack();
        await expect(page.getByRole('link', { name: 'Create Session', exact: true })).toHaveCount(
            0,
        );
        await page.getByRole('link', { name: 'Open Session: Noir night', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(
            page.getByRole('heading', { name: 'Movie Nomination', exact: true }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Session settings', exact: true }).click();
        await expect(
            page.getByRole('menuitem', { name: 'Edit Session', exact: true }),
        ).toBeFocused();
        await page.keyboard.press('Enter');
        // Escape belongs to the dialog only once it has opened and taken focus.
        await expect(page.getByRole('dialog', { name: 'Edit Session' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(
            page.getByRole('button', { name: 'Session settings', exact: true }),
        ).toBeFocused();
        await page.getByRole('button', { name: 'Session settings', exact: true }).click();
        await expect(
            page.getByRole('menuitem', { name: 'Edit Session', exact: true }),
        ).toBeFocused();
        await page.keyboard.press('Enter');
        await page.getByRole('dialog').getByLabel('Location').fill('Room B');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByText('Room B', { exact: true })).toBeVisible();
        await page.goBack();
        await expect(page.getByText('Room B', { exact: true })).toBeVisible();
        await expect(page.getByText('Room A', { exact: true })).toHaveCount(0);
        await page
            .getByRole('region', { name: 'Active Session', exact: true })
            .getByRole('link', { name: 'Open Session', exact: true })
            .click();
        await page.getByRole('button', { name: 'Session settings', exact: true }).click();
        await expect(
            page.getByRole('menuitem', { name: 'Edit Session', exact: true }),
        ).toBeFocused();
        await page.getByRole('menuitem', { name: 'Cancel Session', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled();
        await page.getByLabel('Type CANCEL to confirm').fill('CANCEL');
        await page.getByRole('button', { name: 'Confirm cancellation' }).click();
        await expect(
            page.getByText('This Session was cancelled. Its history is preserved.'),
        ).toBeVisible();
        await page.getByRole('link', { name: 'Back to Hub' }).click();
        await page.getByText('Session history', { exact: true }).click();
        await expect(page.getByRole('link', { name: 'Noir night' }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'Create Session', exact: true })).toBeVisible();
    },
);

test(
    'Pre-selected Movie uses keyboard search and enters Watching',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'valid-session-workflow-preselected');
        await page.goto(ROUTE);
        await page.getByRole('radio', { name: 'Pre-selected Movie' }).check();
        await expect(page.getByLabel('Nomination phase ends in')).toHaveCount(0);
        await page.getByLabel('Date').fill('2090-12-01');
        await page.getByLabel('Location').fill('Room A');
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
        await expect(page.getByRole('heading', { level: 1 }).getByRole('link')).toHaveAttribute(
            'href',
            '/movies/10000000-0000-4000-8000-000000000037',
        );
        await page.getByRole('link', { name: 'Back to Hub' }).click();
        const activeSession = page
            .getByRole('region', { name: 'Active Session', exact: true })
            .getByRole('link', { name: 'Open Session', exact: true });
        await expect(
            page.getByRole('region', { name: 'Active Session', exact: true }),
        ).toContainText('Watching');
        await activeSession.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText('watching', { exact: true })).toBeVisible();
    },
);

test('Session save failure keeps entries and offline submit explains recovery', async ({
    context,
    page,
}) => {
    await authenticate(context, 'valid-session-workflow-failure');
    await page.goto(ROUTE);
    await page.getByLabel('Date').fill('2090-12-01');
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
            'You appear to be offline. Reconnect, then try again; nothing you entered is lost.',
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
        await page.goto(ROUTE, { waitUntil: 'load' });
        await settle(page);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
            path: `test-results/session-create-${viewport.name}.png`,
            fullPage: true,
        });
        await page.getByLabel('Date').fill('2090-12-01');
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
    await page.goto(ROUTE);
    await expect(
        page.getByText('You cannot create a Session in this Club right now.'),
    ).toBeVisible();
    await expect(page.getByLabel('Location')).toHaveCount(0);
    await authenticate(context, 'valid-session-workflow-archived');
    await page.goto(ROUTE);
    await expect(
        page.getByText('You cannot create a Session in this Club right now.'),
    ).toBeVisible();
});

for (const viewport of screenshotViewports) {
    test(
        `Create Session matches the ${viewport.name} prototype composition`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, 'valid-session-workflow-visual');
            await page.setViewportSize(viewport);
            await page.goto(ROUTE, { waitUntil: 'load' });
            await settle(page);
            await expect(page).toHaveScreenshot(`create-session-${viewport.name}.png`, {
                fullPage: true,
                animations: 'disabled',
                caret: 'hide',
                scale: 'css',
            });
        },
    );
}
