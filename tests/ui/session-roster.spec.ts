import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, test } from '@playwright/test';

import { acceptedParticipants } from './session-facts';
import { settle } from './settle';
import { canonicalViewports } from './viewports';

const SESSION_ID = '30000000-0000-4000-8000-000000000041';
const INVITATION_PATH = `/invite/session/${'s'.repeat(43)}`;
async function authenticate(context: BrowserContext, scenario: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `valid-session-roster-${scenario}-${crypto.randomUUID()}`,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

test(
    'Session invite sign-in continuation and private denial',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await page.goto(INVITATION_PATH);
        await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute(
            'href',
            `/login?returnTo=${encodeURIComponent(INVITATION_PATH)}`,
        );
        await authenticate(context, 'outsider');
        await page.reload();
        await expect(page.getByText(/You must already belong to the Club/)).toBeVisible();
        await expect(page.getByText('Private noir night')).toHaveCount(0);
        await expect(page.getByText('Midnight Society')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);
    },
);

test(
    'Session invitation acceptance, roster projection and confirmed leave',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'member');
        await page.goto(INVITATION_PATH);
        await page.getByRole('button', { name: 'Accept invitation' }).click();
        await expect(page.getByText('Your participation is confirmed.')).toBeVisible();
        await page.getByRole('link', { name: 'Open Session' }).click();
        await expect(acceptedParticipants(page)).toHaveText('Jordan Member');
        await expect(page.getByRole('button', { name: 'Create Session invitation' })).toHaveCount(
            0,
        );
        await page.getByRole('button', { name: 'Leave Session', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Confirm leaving' })).toBeDisabled();
        await page.getByLabel('Type LEAVE to confirm').fill('LEAVE');
        await page.getByRole('button', { name: 'Confirm leaving' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(acceptedParticipants(page)).toHaveText('No accepted participants');
    },
);

test(
    'Operators share the Session link and manage existing participants with keyboard and focus return',
    { tag: '@smoke' },
    async ({ context, page }) => {
        await authenticate(context, 'admin');
        await page.goto(`/sessions/${SESSION_ID}`);
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.getByRole('button', { name: 'Invite', exact: true }).click();
        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toBe(`http://127.0.0.1:41730/sessions/${SESSION_ID}`);
        await page.getByRole('button', { name: 'Session settings', exact: true }).click();
        await settle(page);
        await page.getByRole('menuitem', { name: 'Kick', exact: true }).click();
        const kickDialog = page.getByRole('dialog', { name: 'Kick participants' });
        await kickDialog.getByRole('button', { name: 'Revoke invite for Jordan Member' }).click();
        await expect(kickDialog.getByText('invited · invitation revoked')).toBeVisible();
        await kickDialog.getByRole('button', { name: 'Remove Jordan Member' }).click();
        const removalDialog = page.getByRole('dialog', { name: 'Remove participant' });
        await expect(removalDialog.getByLabel('Type REMOVE to confirm')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(removalDialog).toHaveCount(0);
        await expect(
            kickDialog.getByRole('button', { name: 'Remove Jordan Member' }),
        ).toBeFocused();
        await kickDialog.getByRole('button', { name: 'Remove Jordan Member' }).click();
        await page.getByLabel('Type REMOVE to confirm').fill('REMOVE');
        await page.getByRole('button', { name: 'Confirm removal' }).click();
        await expect(kickDialog.getByText('No participants can be removed.')).toBeVisible();
        await expect(kickDialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    },
);

test('a Club member joins directly from the shared Session link', async ({ context, page }) => {
    await authenticate(context, 'member-direct');
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(acceptedParticipants(page)).toHaveText('No accepted participants');
    await page.getByRole('button', { name: 'Join Session', exact: true }).click();
    await expect(acceptedParticipants(page)).toHaveText('Jordan Member');
    await expect(page.getByRole('button', { name: 'Join Session', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Leave Session', exact: true })).toBeVisible();
    await page.reload();
    await expect(acceptedParticipants(page)).toHaveText('Jordan Member');
});

test('Pending Session row opens its accepted Session', async ({ context, page }) => {
    await authenticate(context, 'pending-member');
    await page.goto(`/sessions/${SESSION_ID}`);
    await page.getByRole('button', { name: 'Open pending invites' }).click();
    const row = page
        .getByRole('dialog', { name: 'Pending invites' })
        .getByRole('listitem')
        .filter({ hasText: 'Session invite' });
    await expect(row.getByText('Private noir night', { exact: false })).toBeVisible();
    await row.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(acceptedParticipants(page)).toHaveText('Jordan Member');
});

test('Invitation failures retain preview and offline decline explains recovery', async ({
    context,
    page,
}) => {
    await authenticate(context, 'failure');
    await page.goto(INVITATION_PATH);
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(
        page.getByText('We could not confirm your response. Check your connection and retry.'),
    ).toBeVisible();
    await expect(page.getByText('Private noir night')).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Decline invitation' }).click();
    await expect(
        page.getByText(
            'You appear to be offline. Reconnect, then try again; nothing you entered is lost.',
        ),
    ).toBeVisible();
});

for (const viewport of canonicalViewports) {
    test(`Session invitation and roster accessibility at ${viewport.name}`, async ({
        context,
        page,
    }) => {
        await authenticate(context, 'admin');
        await page.setViewportSize(viewport);
        await page.goto(INVITATION_PATH, { waitUntil: 'load' });
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
            path: test.info().outputPath('session-invitation.png'),
            fullPage: true,
        });
        await page.goto(`/sessions/${SESSION_ID}`, { waitUntil: 'load' });
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
    });
}
