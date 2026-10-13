import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { seedFixture, signIn } from './backend-fixture';
import { settle } from './settle';

test(
    'Club settings persist, typed archive restricts new work, and reactivation restores it',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const fixture = await seedFixture(context);
        await page.goto(`/clubs/${fixture.clubId}/settings`);
        await settle(page);
        await page.getByLabel('Club name', { exact: true }).fill('Noir Society');
        await expect(page.getByLabel('Club name', { exact: true })).toHaveValue('Noir Society');
        await page.getByRole('button', { name: 'Save Changes', exact: true }).first().click();
        await expect(page.getByText('Club settings saved.', { exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Club name', { exact: true })).toHaveValue('Noir Society');
        await page.getByRole('button', { name: 'Archive Club', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Confirm archive club' })).toBeDisabled();
        await page.getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE');
        await page.getByRole('button', { name: 'Confirm archive club' }).click();
        await expect(page.getByRole('button', { name: 'Reactivate Club' })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('button', { name: 'Reactivate Club' })).toBeVisible();
        await page.getByRole('button', { name: 'Reactivate Club' }).click();
        await expect(page.getByRole('button', { name: 'Archive Club', exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('button', { name: 'Archive Club', exact: true })).toBeVisible();
    },
);

test(
    'Club removal returns focus, persists, and revokes the member access',
    { tag: '@smoke' },
    async ({ browser, context, page }) => {
        const fixture = await seedFixture(context);
        await page.goto(`/clubs/${fixture.clubId}/members`);
        await page.getByRole('button', { name: 'Remove Morgan Member' }).click();
        await settle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Remove Morgan Member' })).toBeFocused();
        await page.getByRole('button', { name: 'Remove Morgan Member' }).click();
        await page.getByLabel('Type REMOVE to confirm').fill('REMOVE');
        await page.getByRole('button', { name: 'Confirm removal' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeFocused();
        await page.reload();
        await expect(page.getByText('Morgan Member', { exact: true })).toHaveCount(0);
        const member = await browser.newContext();
        try {
            await signIn(member, fixture.member);
            const memberPage = await member.newPage();
            await memberPage.goto(`/clubs/${fixture.clubId}/members`);
            await expect(memberPage.getByText('Midnight Society', { exact: true })).toHaveCount(0);
        } finally {
            await member.close();
        }
    },
);

test(
    'A real Club invitation joins once and grants the invited user access',
    { tag: '@smoke' },
    async ({ browser, context, page }) => {
        const fixture = await seedFixture(context);
        await page.goto(`/clubs/${fixture.clubId}/settings`);
        await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
        await expect(page.getByLabel('Invitation link', { exact: true })).toBeVisible();
        const link = await page.getByLabel('Invitation link', { exact: true }).inputValue();
        const guest = await browser.newContext();
        try {
            await signIn(guest, fixture.outsider);
            const guestPage = await guest.newPage();
            await guestPage.goto(link);
            await guestPage.getByRole('button', { name: 'Accept Invitation', exact: true }).click();
            await expect(
                guestPage.getByRole('heading', { name: 'Welcome to the Club' }),
            ).toBeVisible();
            await guestPage.goto(`/clubs/${fixture.clubId}/members`);
            await expect(
                guestPage.getByRole('heading', { name: 'Midnight Society' }),
            ).toBeVisible();
            await page.reload();
            await page.getByRole('button', { name: 'Recent invitations' }).click();
            await expect(page.getByText(/accepted · expires/)).toBeVisible();
        } finally {
            await guest.close();
        }
    },
);
