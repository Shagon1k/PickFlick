import { randomUUID } from 'node:crypto';

import { type Browser, expect, type Page, test } from '@playwright/test';

import {
    connectJourneyBackend,
    type IJourneyBackend,
} from '../../apps/backend/src/testing/journeys.ts';

let backend: IJourneyBackend;

test.beforeAll(async () => {
    backend = await connectJourneyBackend();
});

test.afterAll(async () => {
    await backend.close();
});

// Better Auth limits each client address (an IPv6 /64) per minute and keeps the counts in the
// database, so every visitor of every run gets its own documentation-range network.
const runNetwork = randomUUID().slice(0, 4);
let visitors = 0;

async function signedInPage(browser: Browser, displayName: string): Promise<Page> {
    const userId = await backend.createUser(displayName);
    visitors += 1;
    const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `2001:db8:${runNetwork}:${visitors}::1` },
    });
    await context.addCookies(await backend.cookiesFor(userId, '127.0.0.1'));
    return context.newPage();
}

/** A date 30 days ahead in the `YYYY-MM-DD` form the date input accepts. */
function upcomingDate(): string {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test('an Admin founds a Club, a member joins, and their nomination selects the Session Movie', async ({
    browser,
}) => {
    const clubName = `Journey Club ${randomUUID().slice(0, 8)}`;
    const query = `journey-${randomUUID()}`;
    const movie = { id: randomUUID(), title: 'The Night of the Hunter', releaseYear: 1955 };
    await backend.seedMovieSearch(query, [movie]);
    const admin = await signedInPage(browser, 'Avery Admin');
    const member = await signedInPage(browser, 'Jordan Member');
    const outsider = await signedInPage(browser, 'Riley Outsider');

    await test.step('the Admin creates a Club', async () => {
        await admin.goto('/clubs/new');
        await admin.getByRole('textbox', { name: 'Club name — required' }).fill(clubName);
        await admin.getByRole('button', { name: 'Create Screening Room' }).click();
        await expect(admin.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    });

    const clubPath = new URL(admin.url()).pathname;

    await test.step('a User joins through a Club invitation link', async () => {
        await admin.goto(`${clubPath}/settings`);
        await admin.getByRole('button', { name: 'Create invitation' }).click();
        const link = await admin.getByLabel('Invitation link').inputValue();
        await member.goto(link);
        await member.getByRole('button', { name: 'Accept Invitation' }).click();
        await expect(member.getByRole('heading', { name: 'Welcome to the Club' })).toBeVisible();
    });

    await test.step('the Admin invites the member to a new Session, which an outsider cannot see', async () => {
        await admin.goto(clubPath);
        await admin.getByRole('link', { name: 'Create Session', exact: true }).click();
        await admin.getByLabel('Date').fill(upcomingDate());
        await admin.getByLabel('Location').fill('Room A');
        await admin.getByLabel('Topic').fill('Journey night');
        await admin.getByRole('button', { name: 'Create Session', exact: true }).click();
        await expect(admin.getByText('Session created. Nomination is open.')).toBeVisible();
        await admin.getByRole('link', { name: 'Open Session' }).click();
        await admin.getByRole('combobox', { name: 'Invite a Club member' }).click();
        await admin.getByRole('option', { name: 'Jordan Member' }).click();
        await admin.getByRole('button', { name: 'Create Session invitation' }).click();
        const link = await admin.getByLabel('Session invitation link').inputValue();
        await outsider.goto(link);
        await expect(outsider.getByText(/You must already belong to the Club/u)).toBeVisible();
        await expect(outsider.getByText(clubName)).toHaveCount(0);
        await expect(outsider.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);
        await member.goto(link);
        await member.getByRole('button', { name: 'Accept invitation' }).click();
        await expect(member.getByText('Your participation is confirmed.')).toBeVisible();
    });

    await test.step('the sole participant nomination selects the Movie for Watching', async () => {
        await member.getByRole('link', { name: 'Open Session' }).click();
        await member.getByRole('combobox', { name: 'Select a Movie' }).fill(query);
        await member.getByRole('option', { name: /The Night of the Hunter/u }).click();
        await member.getByRole('button', { name: 'Nominate This' }).click();
        for (const page of [member, admin]) {
            await page.reload();
            await expect(page.getByText('watching', { exact: true })).toBeVisible();
            await expect(page.getByRole('link', { name: 'View selected Movie' })).toHaveAttribute(
                'href',
                `/movies/${movie.id}`,
            );
        }
    });
});
