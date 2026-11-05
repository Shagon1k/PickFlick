import { randomUUID } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import type { TMovieDetails } from '@pickflick/contracts';
import { type Browser, expect, type Page, test } from '@playwright/test';

import { buildDetailsCacheKey } from '../../apps/backend/src/modules/movies/catalog-cache-key.ts';
import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { loadRuntimeEnvironment } from '../../packages/config/src/environment.ts';
import { settle } from '../ui/settle.ts';
import { canonicalViewports } from '../ui/viewports.ts';
import { openVisitor } from './visitors';

async function createPastJourney(browser: Browser) {
    const backend = await connectJourneyBackend();
    const { prisma } = backend;
    const clubId = randomUUID();
    const movieId = randomUUID();
    const rivalId = randomUUID();
    const users = await Promise.all(
        ['Operator', 'Former attendee', 'Current attendee'].map((name) => backend.createUser(name)),
    );
    await prisma.club.create({
        data: {
            id: clubId,
            name: 'Historical screening club',
            selectionScaleMin: 0,
            selectionScaleMax: 5,
            showSelectionScoresAfter: true,
            showNominationAuthorsAfter: true,
            showRatingsAfter: true,
        },
    });
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
    const rivalQuery = `Rival ${rivalId}`;
    await backend.seedMovieSearch(rivalQuery, [
        { id: rivalId, title: 'A remembered rival', releaseYear: 2001 },
    ]);
    const metadata: TMovieDetails = {
        id: movieId,
        title: 'A remembered film',
        originalTitle: null,
        overview: 'A screening remembered by the Club.',
        releaseDate: null,
        releaseYear: 1999,
        adult: false,
        productionCountries: null,
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
    const context = await openVisitor(browser, backend, users[0]!, { hasTouch: true });
    return {
        clubId,
        movieId,
        query,
        rivalQuery,
        context,
        prisma,
        signInMember: async () => {
            await context.clearCookies();
            await context.addCookies(await backend.cookiesFor(users[2]!, '127.0.0.1'));
        },
        cleanup: async () => {
            await context.close();
            await backend.removeUsers(users);
            await backend.removeMovies([movieId, rivalId]);
            await backend.close();
        },
    };
}

async function addNomination(page: Page, query: string) {
    const search = page.getByRole('combobox', { name: /^Nominated films/u });
    await search.fill(query);
    await expect(
        page
            .getByRole('group', { name: 'What else was nominated?' })
            .getByRole('listbox', { name: 'Film results' })
            .getByRole('option'),
    ).toHaveCount(1);
    await search.press('ArrowDown');
    await search.press('Enter');
}

/** Step one: the screened film, its date and place. */
async function fillFilm(page: Page, query: string, location = 'Old cinema') {
    const form = page.getByRole('region', { name: 'Log a Past Session', exact: true });
    const search = page.getByRole('combobox', { name: 'Select a Movie' });
    await search.fill(query);
    await expect(page.getByRole('option')).toHaveCount(1);
    await search.press('ArrowDown');
    await search.press('Enter');
    await form.getByLabel('Date').fill('2020-01-01');
    await form.getByLabel('Location').fill(location);
}

const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true }).click();
const back = (page: Page) => page.getByRole('button', { name: 'Back', exact: true }).click();
const logSession = (page: Page) =>
    page.getByRole('button', { name: 'Log Session', exact: true }).click();
const ratingFor = (page: Page, name: string) =>
    page.getByRole('radiogroup', { name: `Rating for ${name}` });

test('A minimal past Session waits for hydration, retains input after a request failure and denies Member creation', async ({
    browser,
}) => {
    const journey = await createPastJourney(browser);
    const { clubId, context, query, prisma } = journey;
    const page = await context.newPage();
    const form = page.getByRole('region', { name: 'Log a Past Session', exact: true });
    const path = `/clubs/${clubId}/sessions/past/new`;
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>((resolve) => {
        releaseScripts = resolve;
    });
    await page.route('**/_next/static/chunks/*.js', async (route) => {
        await scriptsReady;
        await route.continue();
    });
    try {
        await page.goto(path, { waitUntil: 'commit' });
        await expect(form.getByLabel('Date')).toBeDisabled();
        await expect(
            form.getByRole('button', { name: 'Next', exact: true, includeHidden: true }),
        ).toBeDisabled();
        releaseScripts();
        await expect(form.getByLabel('Date')).toBeEnabled();
        await fillFilm(page, query);
        await expect(form.getByLabel('Date')).toHaveValue('2020-01-01');
        await next(page);
        await next(page);
        await page.getByRole('button', { name: 'Remove A remembered film', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Log Session', exact: true })).toBeEnabled();
        expect(await prisma.session.findMany({ where: { clubId } })).toEqual([]);
        await page.route(`**${path}`, (route) => route.abort('failed'), { times: 1 });
        await logSession(page);
        await expect(
            page.getByText('We could not reach PickFlick. Your entries are still here; try again.'),
        ).toBeVisible();
        await back(page);
        await back(page);
        await expect(form.getByLabel('Location')).toHaveValue('Old cinema');
        await expect(page.getByRole('textbox', { name: 'Select a Movie' })).toHaveValue(
            'A remembered film',
        );
        await next(page);
        await next(page);
        await logSession(page);
        // Logging opens the new Session itself.
        await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/u);
        expect(await prisma.sessionParticipant.findMany({ where: { clubId } })).toEqual([]);
        expect(await prisma.sessionRating.findMany({ where: { session: { clubId } } })).toEqual([]);
        await expect(page.getByText('Not recorded', { exact: true })).toBeVisible();
        await expect(page.getByText('No ratings were received.')).toBeVisible();
        await journey.signInMember();
        await page.goto(path);
        await expect(
            page.getByText('You cannot log a past Session in this Club right now.'),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
    } finally {
        releaseScripts();
        await journey.cleanup();
    }
});

test('Retrying after a lost committed response rejects changed evidence and preserves the saved Session', async ({
    browser,
}) => {
    const journey = await createPastJourney(browser);
    const { clubId, context, query, prisma } = journey;
    const page = await context.newPage();
    const form = page.getByRole('region', { name: 'Log a Past Session', exact: true });
    const path = `/clubs/${clubId}/sessions/past/new`;
    try {
        await page.goto(path);
        await settle(page);
        await fillFilm(page, query);
        await next(page);
        await page.getByRole('checkbox', { name: 'Former attendee (former member)' }).check();
        await page.getByRole('checkbox', { name: 'Current attendee', exact: true }).check();
        const ratings = ratingFor(page, 'Former attendee');
        await ratings.getByRole('radio', { name: '8 of 10', exact: true }).click();
        await next(page);
        await page.route(
            `**${path}`,
            async (route) => {
                await route.fetch();
                await route.abort('failed');
            },
            { times: 1 },
        );
        await logSession(page);
        await expect(
            page.getByText('We could not reach PickFlick. Your entries are still here; try again.'),
        ).toBeVisible();
        const committed = await prisma.session.findFirstOrThrow({ where: { clubId } });
        await back(page);
        await page.getByRole('checkbox', { name: 'Current attendee', exact: true }).uncheck();
        await ratings.getByRole('radio', { name: '9 of 10', exact: true }).click();
        await back(page);
        await form.getByLabel('Location').fill('Changed cinema');
        await next(page);
        await next(page);
        await logSession(page);
        await expect(
            page.getByText(
                'This Session was already logged with different entries. Your changes were not saved. Open Club history to review it.',
            ),
        ).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));
        await back(page);
        await expect(
            page.getByRole('checkbox', { name: 'Current attendee', exact: true }),
        ).not.toBeChecked();
        await expect(ratings.getByRole('radio', { name: '9 of 10', exact: true })).toBeChecked();
        await back(page);
        await expect(form.getByLabel('Location')).toHaveValue('Changed cinema');
        expect(await prisma.session.findUniqueOrThrow({ where: { id: committed.id } })).toEqual(
            committed,
        );
        await form.getByLabel('Location').fill('Old cinema');
        await next(page);
        await page.getByRole('checkbox', { name: 'Current attendee', exact: true }).check();
        await ratings.getByRole('radio', { name: '8 of 10', exact: true }).click();
        await next(page);
        await logSession(page);
        await expect(page).toHaveURL(new RegExp(`/sessions/${committed.id}$`, 'u'));
        expect(await prisma.session.findMany({ where: { clubId } })).toHaveLength(1);
        expect(await prisma.sessionParticipant.findMany({ where: { clubId } })).toHaveLength(2);
        expect(await prisma.sessionRating.findMany({ where: { sessionId: committed.id } })).toEqual(
            [expect.objectContaining({ score: 8, submittedAt: null })],
        );
        expect(
            await prisma.clubAuditEvent.findMany({ where: { clubId, action: 'SESSION_CREATED' } }),
        ).toHaveLength(1);
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
            const { clubId, query, rivalQuery, context, prisma } = journey;
            const page = await context.newPage();
            const form = page.getByRole('region', { name: 'Log a Past Session', exact: true });
            await page.setViewportSize(viewport);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            try {
                await page.goto(`/clubs/${clubId}/sessions`);
                await page.getByRole('link', { name: 'Log Past', exact: true }).click();
                await settle(page);
                await expect(
                    page.getByRole('heading', { name: 'Log a Past Session' }),
                ).toBeVisible();
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await next(page);
                await expect(page.getByRole('combobox', { name: 'Select a Movie' })).toBeFocused();
                await fillFilm(page, query);
                await form.getByLabel('Date').fill('2999-01-01');
                await next(page);
                await expect(
                    page.getByText('Choose a valid date in the past.').last(),
                ).toBeVisible();
                await form.getByLabel('Date').fill('2020-01-01');
                await form.getByLabel('Notes').fill('Only one historical rating is known.');
                await next(page);
                await page
                    .getByRole('checkbox', { name: 'Former attendee (former member)' })
                    .check();
                await page.getByRole('checkbox', { name: 'Current attendee', exact: true }).check();
                const ratings = ratingFor(page, 'Former attendee');
                await ratings.getByRole('radio', { name: '1 of 10', exact: true }).focus();
                await page.keyboard.press('End');
                await page.keyboard.press('ArrowLeft');
                await expect(ratings.getByRole('radio', { name: '9 of 10' })).toBeFocused();
                // Choosing the same star again clears the rating.
                await page.keyboard.press('Enter');
                await expect(ratings.getByRole('radio', { checked: true })).toHaveCount(0);
                await ratings.getByRole('radio', { name: '9 of 10', exact: true }).tap();
                await expect(
                    ratings.getByRole('radio', { name: '9 of 10', exact: true }),
                ).toBeChecked();
                await next(page);
                // The screened film starts as a nominee.
                await expect(
                    page.getByRole('button', { name: 'Remove A remembered film', exact: true }),
                ).toBeVisible();
                await addNomination(page, rivalQuery);
                await expect(
                    page.getByRole('combobox', { name: /^Nominated films · 2\/2/u }),
                ).toBeDisabled();
                const zero = page.getByRole('combobox', {
                    name: 'Selection score for Former attendee: A remembered film',
                    exact: true,
                });
                await zero.focus();
                await zero.selectOption('0');
                await expect(zero).toHaveValue('0');
                const unknown = page.getByRole('combobox', {
                    name: 'Selection score for Current attendee: A remembered rival',
                    exact: true,
                });
                await unknown.selectOption('5');
                await unknown.selectOption('');
                await expect(unknown).toHaveValue('');
                await page
                    .getByRole('button', { name: 'Remove A remembered film', exact: true })
                    .click();
                await expect(
                    page.getByRole('combobox', { name: /^Nominated films/u }),
                ).toBeFocused();
                await back(page);
                await back(page);
                await expect(page.getByRole('textbox', { name: 'Select a Movie' })).toHaveValue(
                    'A remembered film',
                );
                await next(page);
                await next(page);
                await expect(
                    page.getByRole('button', { name: 'Remove A remembered film', exact: true }),
                ).toHaveCount(0);
                await expect(
                    page.getByRole('button', { name: 'Remove A remembered rival', exact: true }),
                ).toBeVisible();
                await addNomination(page, query);
                await expect(zero).toHaveValue('');
                await zero.selectOption('0');
                const nominator = page.getByRole('combobox', {
                    name: 'Nominated by · A remembered film',
                });
                await nominator.click();
                await page
                    .getByRole('option', { name: 'Former attendee (former member)', exact: true })
                    .click();
                await context.setOffline(true);
                await logSession(page);
                await expect(
                    page.getByRole('status').filter({ hasText: /offline/iu }),
                ).toBeVisible();
                await context.setOffline(false);
                await expect(zero).toHaveValue('0');
                await settle(page);
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await logSession(page);
                await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/u);
                // A logged Session carries one LOGGED note instead of per-section caveats.
                await expect(
                    page.getByRole('button', { name: 'About logged Sessions' }),
                ).toBeVisible();
                await expect(page.getByText(/This session has ended/)).toBeVisible();
                await page.getByRole('list', { name: 'Session ratings' }).scrollIntoViewIfNeeded();
                await expect(
                    page
                        .getByRole('list', { name: 'Session ratings' })
                        .getByText('9.0', { exact: true })
                        .first(),
                ).toBeVisible();
                const rivals = page.getByRole('region', { name: 'Nomination Rivals' });
                await expect(rivals.getByText('A remembered rival', { exact: true })).toBeVisible();
                await expect(rivals.getByText('0', { exact: true }).first()).toBeVisible();
                await expect(rivals.getByText('total · 1 score', { exact: true })).toBeVisible();
                await expect(rivals.getByText('Watched', { exact: true })).toBeVisible();
                await expect(rivals.getByText('by Former attendee', { exact: true })).toBeVisible();
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
                await journey.signInMember();
                await page.reload();
                await expect(rivals.getByText('A remembered rival', { exact: true })).toBeVisible();
                await prisma.club.update({
                    where: { id: clubId },
                    data: {
                        showSelectionScoresAfter: false,
                        showNominationAuthorsAfter: false,
                        showRatingsAfter: false,
                    },
                });
                await page.reload();
                await expect(
                    page
                        .getByRole('region', { name: 'Session details', exact: true })
                        .getByText('9.0', { exact: true })
                        .first(),
                ).toBeVisible();
                await expect(page.getByText('Votes are hidden for this Session.')).toBeVisible();
                await expect(page.getByText('A remembered rival', { exact: true })).toHaveCount(0);
            } finally {
                await journey.cleanup();
            }
        },
    );
}
