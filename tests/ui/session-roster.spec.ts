import { expect, test } from '@playwright/test';

import { seedFixture, signIn } from './backend-fixture';

test(
    'Session invite targets an existing member, accepts once, and supports typed removal',
    { tag: '@smoke' },
    async ({ browser, context, page }) => {
        const fixture = await seedFixture(context, true);
        await page.goto(`/sessions/${fixture.sessionId}`);
        await page.getByRole('combobox', { name: 'Invite a Club member' }).click();
        await page.getByRole('option', { name: 'Morgan Member' }).click();
        await page.getByRole('button', { name: 'Create Session invitation' }).click();
        const link = await page.getByLabel('Session invitation link').inputValue();
        const member = await browser.newContext();
        try {
            await signIn(member, fixture.member);
            const memberPage = await member.newPage();
            await memberPage.goto(link);
            await memberPage
                .getByRole('button', { name: 'Accept invitation', exact: true })
                .click();
            await expect(memberPage.getByText('Your participation is confirmed.')).toBeVisible();
            await page.reload();
            await expect(page.getByText('2 accepted', { exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Remove Morgan Member', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Confirm removal' })).toBeDisabled();
            await page.getByLabel('Type REMOVE to confirm').fill('REMOVE');
            await page.getByRole('button', { name: 'Confirm removal' }).click();
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(
                page.getByRole('heading', { name: 'Participants', exact: true }),
            ).toBeFocused();
            await page.reload();
            await expect(page.getByText('1 accepted', { exact: true })).toBeVisible();
            await memberPage.goto(link);
            await expect(memberPage.getByText(/This invitation is unavailable/)).toBeVisible();
        } finally {
            await member.close();
        }
    },
);

test(
    'Outsider Session invitation discloses no Club or Session details',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const fixture = await seedFixture(context, true);
        await signIn(context, fixture.outsider);
        await page.goto(`/sessions/${fixture.sessionId}`);
        await expect(page.getByRole('heading', { name: 'Noir night' })).toHaveCount(0);
        await expect(page.getByText('Room A', { exact: true })).toHaveCount(0);
    },
);
