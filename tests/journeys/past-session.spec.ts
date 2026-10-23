import { randomUUID } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import type { TMovieDetails } from '@pickflick/contracts';
import { type Browser, expect, test } from '@playwright/test';

import { buildDetailsCacheKey } from '../../apps/backend/src/modules/movies/catalog-cache-key.ts';
import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { loadRuntimeEnvironment } from '../../packages/config/src/environment.ts';
import { createDatabaseClient } from '../../packages/database/src/index.ts';
import { settle } from '../ui/settle.ts';
import { canonicalViewports } from '../ui/viewports.ts';

async function createPastJourney(browser: Browser) {
    const backend = await connectJourneyBackend();
    const prisma = createDatabaseClient(loadRuntimeEnvironment().databaseUrl);
    const clubId = randomUUID();
    const movieId = randomUUID();
    const users = await Promise.all(
        ['Operator', 'Former attendee', 'Current attendee'].map((name) => backend.createUser(name)),
    );
    await prisma.club.create({ data: { id: clubId, name: 'Historical screening club' } });
    for (const [index, userId] of users.entries())
        await prisma.membership.create({
            data: {
                id: randomUUID(),
                clubId,
                userId,
                role: index === 0 ? 'ADMIN' : 'MEMBER',
                status: index === 1 ? 'LEFT' : 'ACTIVE',
                leftAt: index === 1 ? new Date() : null,
            },
        });
    const query = `Historical ${movieId}`;
    await backend.seedMovieSearch(query, [
        { id: movieId, title: 'A remembered film', releaseYear: 1999 },
    ]);
    const metadata: TMovieDetails = {
        id: movieId,
        title: 'A remembered film',
        originalTitle: null,
        overview: 'A screening remembered by the Club.',
        releaseDate: null,
        releaseYear: 1999,
        adult: false,
        originalLanguage: 'en',
        posterUrl: null,
        backdropUrl: null,
        ratings: [],
        runtime: 120,
        genres: ['Drama'],
        directors: [{ name: 'Historical director' }],
        writers: null,
        cast: null,
        trailers: null,
        budget: null,
        revenue: null,
        similarMovieIds: null,
        provenance: [],
    };
    const environment = loadRuntimeEnvironment();
    await prisma.movieDetailsCache.create({
        data: {
            movieId,
            key: buildDetailsCacheKey(environment.catalog.provider, environment.catalog.locale),
            fetchedAt: new Date(),
            data: metadata,
        },
    });
    const context = await browser.newContext({
        hasTouch: true,
        extraHTTPHeaders: { 'x-forwarded-for': `2001:db8:${randomUUID().slice(0, 4)}::1` },
    });
    await context.addCookies(await backend.cookiesFor(users[0]!, '127.0.0.1'));
    return {
        clubId,
        movieId,
        query,
        context,
        prisma,
        signInMember: async () => {
            await context.clearCookies();
            await context.addCookies(await backend.cookiesFor(users[2]!, '127.0.0.1'));
        },
        cleanup: async () => {
            await context.close();
            await prisma.clubAuditEvent.deleteMany({ where: { clubId } });
            await prisma.sessionRating.deleteMany({ where: { session: { clubId } } });
            await prisma.sessionParticipant.deleteMany({ where: { clubId } });
            await prisma.session.deleteMany({ where: { clubId } });
            await prisma.membership.deleteMany({ where: { clubId } });
            await prisma.club.delete({ where: { id: clubId } });
            await prisma.movieDetailsCache.deleteMany({ where: { movieId } });
            await prisma.movie.delete({ where: { id: movieId } });
            await prisma.user.deleteMany({ where: { id: { in: users } } });
            await prisma.$disconnect();
            await backend.close();
        },
    };
}

test('A minimal past Session retains input after a request failure and denies Member creation', async ({
    browser,
}) => {
    const journey = await createPastJourney(browser);
    const { clubId, context, query, prisma } = journey;
    const page = await context.newPage();
    const path = `/clubs/${clubId}/sessions/past/new`;
    try {
        await page.goto(path);
        await page.getByLabel('Date').fill('2020-01-01');
        await page.getByLabel('Location').fill('Old cinema');
        const search = page.getByRole('combobox', { name: 'Select a Movie' });
        await search.fill(query);
        await expect(page.getByRole('option')).toHaveCount(1);
        await search.press('ArrowDown');
        await search.press('Enter');
        await page.route(`**${path}`, (route) => route.abort('failed'), { times: 1 });
        await page.getByRole('button', { name: 'Log Session', exact: true }).click();
        await expect(
            page.getByText('We could not reach PickFlick. Your entries are still here; try again.'),
        ).toBeVisible();
        await expect(page.getByLabel('Location')).toHaveValue('Old cinema');
        await page.getByRole('button', { name: 'Log Session', exact: true }).click();
        await expect(page.getByRole('link', { name: 'Open Session', exact: true })).toBeVisible();
        expect(await prisma.sessionParticipant.findMany({ where: { clubId } })).toEqual([]);
        expect(await prisma.sessionRating.findMany({ where: { session: { clubId } } })).toEqual([]);
        await page.getByRole('link', { name: 'Open Session', exact: true }).click();
        await expect(page.getByText('No attendance record is available.')).toBeVisible();
        await expect(page.getByText('No ratings were received.')).toBeVisible();
        await journey.signInMember();
        await page.goto(path);
        await expect(
            page.getByText('You cannot log a past Session in this Club right now.'),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Log Session', exact: true })).toHaveCount(0);
    } finally {
        await journey.cleanup();
    }
});

for (const viewport of canonicalViewports) {
    test(
        `Past Session preserves partial imported evidence at ${viewport.name}`,
        { tag: '@smoke' },
        async ({ browser }) => {
            const journey = await createPastJourney(browser);
            const { clubId, query, context, prisma } = journey;
            const page = await context.newPage();
            await page.setViewportSize(viewport);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            try {
                await page.goto(`/clubs/${clubId}/sessions`);
                await page.getByRole('link', { name: 'Log a Past Session' }).click();
                await settle(page);
                await expect(
                    page.getByRole('heading', { name: 'Log a Past Session' }),
                ).toBeVisible();
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await page.getByRole('button', { name: 'Log Session', exact: true }).click();
                await expect(page.getByLabel('Date')).toBeFocused();
                await page.getByLabel('Date').fill('2999-01-01');
                await page.getByLabel('Location').fill('Old cinema');
                const search = page.getByRole('combobox', { name: 'Select a Movie' });
                await search.fill(query);
                await expect(page.getByRole('option')).toHaveCount(1);
                await search.press('ArrowDown');
                await search.press('Enter');
                await page.getByRole('button', { name: 'Log Session', exact: true }).click();
                await expect(
                    page.getByText('Choose a valid date in the past.').last(),
                ).toBeVisible();
                await page.getByLabel('Date').fill('2020-01-01');
                await page.getByLabel('Notes').fill('Only one historical rating is known.');
                await page
                    .getByRole('checkbox', { name: 'Former attendee (former member)' })
                    .check();
                await page.getByRole('checkbox', { name: 'Current attendee', exact: true }).check();
                const ratings = page.getByRole('radiogroup', {
                    name: 'Rating for Former attendee (optional)',
                });
                await ratings.getByRole('radio', { name: '1 of 10', exact: true }).focus();
                await page.keyboard.press('End');
                await page.keyboard.press('ArrowLeft');
                await expect(ratings.getByRole('radio', { name: '9 of 10' })).toBeFocused();
                await page.getByRole('button', { name: 'Clear rating' }).click();
                await expect(ratings.getByRole('radio', { checked: true })).toHaveCount(0);
                await ratings.getByRole('radio', { name: '9 of 10', exact: true }).tap();
                await expect(
                    page.getByText('Rating for Former attendee (optional)', { exact: true }),
                ).toBeVisible();
                await context.setOffline(true);
                await page.getByRole('button', { name: 'Log Session', exact: true }).click();
                await expect(
                    page.getByRole('status').filter({ hasText: /offline/iu }),
                ).toBeVisible();
                await context.setOffline(false);
                await expect(page.getByLabel('Notes')).toHaveValue(
                    'Only one historical rating is known.',
                );
                await settle(page);
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await page.screenshot({
                    path: `test-results/past-form-${viewport.name}.png`,
                    fullPage: true,
                });
                await page.getByRole('button', { name: 'Log Session', exact: true }).click();
                await expect(
                    page.getByText('Past Session logged. This screening record is complete.'),
                ).toBeVisible();
                await page.getByRole('link', { name: 'Open Session', exact: true }).click();
                await expect(page.getByText('completed', { exact: true })).toBeVisible();
                await expect(page.getByText(/Imported past screening/)).toBeVisible();
                await page
                    .getByRole('heading', { name: 'Individual Ratings' })
                    .scrollIntoViewIfNeeded();
                await expect(page.getByText('9/10', { exact: true })).toBeVisible();
                await expect(page.getByText(/Original submission times are unknown/)).toBeVisible();
                await expect(
                    page.getByText('No Selection record is available for this screening.'),
                ).toBeVisible();
                await expect(page.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
                expect(
                    await prisma.sessionRating.findMany({ where: { session: { clubId } } }),
                ).toEqual([expect.objectContaining({ score: 9, submittedAt: null })]);
                expect(
                    await prisma.nomination.findMany({ where: { session: { clubId } } }),
                ).toEqual([]);
                expect(
                    await prisma.selectionBallot.findMany({ where: { session: { clubId } } }),
                ).toEqual([]);
                await settle(page);
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await page.screenshot({
                    path: `test-results/past-completed-${viewport.name}.png`,
                    fullPage: true,
                });
            } finally {
                await journey.cleanup();
            }
        },
    );
}
