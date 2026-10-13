import { expect, type Page, test } from '@playwright/test';

import { seedFixture, signIn } from './backend-fixture';

// A second accepted participant keeps Nomination open while the first submits.
async function inviteMember(page: Page) {
    await page.getByRole('combobox', { name: 'Invite a Club member' }).click();
    await page.getByRole('option', { name: 'Morgan Member' }).click();
    await page.getByRole('button', { name: 'Create Session invitation' }).click();
    await expect(page.getByLabel('Session invitation link')).toBeVisible();
    return page.getByLabel('Session invitation link').inputValue();
}

test(
    'Persisted nomination locks submission and polling updates another open tab',
    { tag: '@smoke' },
    async ({ browser, context, page }) => {
        const fixture = await seedFixture(context, true);
        await page.goto(`/sessions/${fixture.sessionId}`);
        const link = await inviteMember(page);
        const member = await browser.newContext();
        const viewer = await browser.newContext();
        try {
            await signIn(member, fixture.member);
            const memberPage = await member.newPage();
            await memberPage.goto(link);
            await memberPage
                .getByRole('button', { name: 'Accept invitation', exact: true })
                .click();
            await expect(memberPage.getByText('Your participation is confirmed.')).toBeVisible();
            await signIn(viewer, fixture.admin);
            const viewerPage = await viewer.newPage();
            await viewerPage.goto(`/sessions/${fixture.sessionId}`);
            await page.reload();
            await page.getByRole('button', { name: 'Refresh nominations' }).click();
            await expect(page.getByText('Nominations refreshed.', { exact: true })).toBeVisible();
            const search = page.getByRole('combobox', { name: 'Select a Movie' });
            await search.fill('Synthetic');
            await page.getByRole('option', { name: /Synthetic Movie/ }).click();
            await page.getByRole('button', { name: 'Nominate This' }).click();
            await expect(page.getByText(/Your nomination: Synthetic Movie/)).toBeVisible();
            await expect(viewerPage.getByText(/Your nomination: Synthetic Movie/)).toBeVisible({
                timeout: 15_000,
            });
            await page.reload();
            await expect(page.getByRole('button', { name: 'Nominate This' })).toHaveCount(0);
            await memberPage.goto(`/sessions/${fixture.sessionId}`);
            await expect(
                memberPage.getByText('Nominations are hidden until you submit your own Movie.'),
            ).toBeVisible();
            await expect(memberPage.getByRole('link', { name: 'Synthetic Movie' })).toHaveCount(0);
            await page
                .getByRole('button', { name: 'Close nominations early', exact: true })
                .click();
            await expect(page.getByRole('button', { name: 'Confirm close' })).toBeDisabled();
            await page.getByLabel('Type CLOSE to confirm').fill('CLOSE');
            await page.getByRole('button', { name: 'Confirm close' }).click();
            await expect(page.getByText('watching', { exact: true })).toBeVisible();
            await expect(viewerPage.getByText('watching', { exact: true })).toBeVisible({
                timeout: 15_000,
            });
        } finally {
            await member.close();
            await viewer.close();
        }
    },
);
