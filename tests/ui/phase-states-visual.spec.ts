import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { screenshotViewports } from './viewports';

const CLUB_PATH = '/clubs/10000000-0000-4000-8000-000000000031';
const SELECTION_PATH = '/sessions/30000000-0000-4000-8000-000000000045';
const WATCHING_PATH = '/sessions/30000000-0000-4000-8000-000000000049';
const RATING_PATH = '/sessions/30000000-0000-4000-8000-000000000050';
const MOVIE_PATH = '/movies/10000000-0000-4000-8000-000000000037';

const STATES = [
    {
        name: 'selection-outcome-visible',
        path: SELECTION_PATH,
        token: 'valid-selection-outcome-visible',
        ready: 'Tonight’s pick',
    },
    {
        name: 'selection-outcome-hidden',
        path: SELECTION_PATH,
        token: 'valid-selection-outcome-hidden-anonymous',
        ready: 'Vote breakdowns are hidden',
    },
    {
        name: 'watching-operator',
        path: WATCHING_PATH,
        token: 'valid-watching-visual',
        ready: 'Room A',
    },
    {
        name: 'watching-readonly',
        path: WATCHING_PATH,
        token: 'valid-watching-readonly',
        ready: 'Room A',
    },
    {
        name: 'rating-form',
        path: RATING_PATH,
        token: 'valid-rating-visual',
        ready: 'Submit Rating',
    },
    {
        name: 'rating-readonly',
        path: RATING_PATH,
        token: 'valid-rating-readonly',
        ready: 'Rating in progress',
    },
    {
        name: 'rating-completed',
        path: RATING_PATH,
        token: 'valid-rating-visual-completed',
        ready: 'Individual Ratings',
    },
    {
        name: 'rating-empty-completed',
        path: RATING_PATH,
        token: 'valid-rating-empty-completed',
        ready: 'No ratings were received.',
    },
    {
        name: 'completed-history',
        path: RATING_PATH,
        token: 'valid-rating-history-completed',
        ready: 'Nomination Rivals',
    },
    {
        name: 'completed-history-hidden',
        path: RATING_PATH,
        token: 'valid-rating-history-hidden-completed',
        ready: 'Vote breakdowns are hidden',
    },
    {
        name: 'hub-history',
        path: `${CLUB_PATH}/sessions`,
        token: 'valid-hub-history',
        ready: 'History',
    },
    {
        name: 'hub-history-hidden',
        path: `${CLUB_PATH}/sessions`,
        token: 'valid-hub-history-hidden',
        ready: 'History',
    },
    {
        name: 'hub-history-empty',
        path: `${CLUB_PATH}/sessions`,
        token: 'valid-hub-empty',
        ready: 'No completed Sessions yet.',
    },
    {
        name: 'club-ratings-populated',
        path: `${CLUB_PATH}/ratings`,
        token: 'valid-hub-ratings-pro-visual',
        ready: 'Synthetic film 28',
    },
    {
        name: 'club-ratings-free',
        path: `${CLUB_PATH}/ratings`,
        token: 'valid-hub-ratings-free',
        ready: 'Extended Club analytics',
    },
    {
        name: 'club-ratings-empty',
        path: `${CLUB_PATH}/ratings`,
        token: 'valid-hub-ratings-pro-empty',
        ready: 'No published ratings yet.',
    },
    {
        name: 'club-ratings-error',
        path: `${CLUB_PATH}/ratings`,
        token: 'valid-hub-ratings-unavailable',
        ready: 'Club Ratings are temporarily unavailable',
    },
    {
        name: 'library-ratings',
        path: '/library',
        token: 'valid-library-visual',
        ready: '28 films rated',
    },
    {
        name: 'library-empty',
        path: '/library',
        token: 'valid-empty-library-visual',
        ready: 'No rated films yet.',
    },
    {
        name: 'library-filtered-empty',
        path: '/library?q=missing',
        token: 'valid-library-filtered-visual',
        ready: 'No films match your search or filters.',
    },
    {
        name: 'library-statistics-long',
        path: '/library?q=Grand&score=8',
        token: 'valid-library-stats-visual',
        ready: 'The Grand Budapest Hotel',
    },
    {
        name: 'library-error',
        path: '/library?q=Grand&score=8',
        token: 'valid-library-unavailable',
        ready: 'Your ratings are temporarily unavailable.',
    },
    {
        name: 'library-statistics-error',
        path: '/library?q=Grand&score=8',
        token: 'valid-library-statistics-timeout',
        ready: 'Your statistics are temporarily unavailable.',
    },
    {
        name: 'watchlist-empty',
        path: '/library?tab=watchlist',
        token: 'valid-visual-watchlist-empty',
        ready: 'Your Watchlist is empty.',
    },
    {
        name: 'achievements-library',
        path: '/library?tab=achievements',
        token: 'valid-visual-achievements',
        ready: 'First Screening',
    },
    {
        name: 'achievements-club',
        path: `${CLUB_PATH}/achievements`,
        token: 'valid-hub-achievements-visual',
        ready: 'First Screening',
    },
    {
        name: 'achievements-empty',
        path: '/library?tab=achievements',
        token: 'valid-achievements-empty',
        ready: '0 of 0 achievements shown',
    },
    {
        name: 'achievements-error',
        path: '/library?tab=achievements',
        token: 'valid-achievements-transient',
        ready: 'Your achievements are temporarily unavailable.',
    },
];

async function authenticate(context: BrowserContext, token: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `${token}-phase-visual-${crypto.randomUUID()}`,
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
}

for (const viewport of screenshotViewports) {
    for (const state of STATES) {
        test(
            `${state.name} matches ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await authenticate(context, state.token);
                await page.setViewportSize(viewport);
                await page.goto(state.path, { waitUntil: 'load' });
                await expect(page.getByText(state.ready, { exact: false }).first()).toBeVisible();
                // Historical rivals sit below the lazy-image loading range on phones.
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await settle(page);
                await page.evaluate(() => window.scrollTo(0, 0));
                await settle(page);
                await expect(page).toHaveScreenshot(`${state.name}-${viewport.name}.png`, {
                    fullPage: true,
                });
            },
        );
    }

    for (const phase of [
        {
            name: 'selection-close',
            path: SELECTION_PATH,
            token: 'valid-selection-operator',
            action: 'Close Selection early',
        },
        {
            name: 'watching-open-rating',
            path: WATCHING_PATH,
            token: 'valid-watching-visual',
            action: 'Open Rating',
        },
        {
            name: 'rating-close',
            path: RATING_PATH,
            token: 'valid-rating-visual',
            action: 'Close Rating early',
        },
    ]) {
        test(
            `${phase.name} dialog matches ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await authenticate(context, phase.token);
                await page.setViewportSize(viewport);
                await page.goto(phase.path, { waitUntil: 'load' });
                await settle(page);
                await page.getByRole('button', { name: 'Session settings', exact: true }).click();
                await expect(
                    page.getByRole('menuitem', { name: phase.action, exact: true }),
                ).toBeFocused();
                await settle(page);
                await page.keyboard.press('Enter');
                await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
                await settle(page);
                await expect(page).toHaveScreenshot(`${phase.name}-${viewport.name}.png`);
            },
        );
    }

    test(
        `Personal Rating editor and saved state match ${viewport.name}`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, 'valid-visual-personal-rating');
            await page.setViewportSize(viewport);
            await page.goto(MOVIE_PATH, { waitUntil: 'load' });
            await page.getByRole('button', { name: 'Rate this film', exact: true }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toHaveCSS('opacity', '1');
            await settle(page);
            await expect(page).toHaveScreenshot(`personal-rating-editor-${viewport.name}.png`);
            await dialog.getByRole('radio', { name: '7 of 10', exact: true }).check();
            await dialog.getByRole('button', { name: 'Save rating', exact: true }).click();
            await expect(dialog.getByText('Personal Rating saved.')).toBeVisible();
            await settle(page);
            await expect(page).toHaveScreenshot(`personal-rating-saved-${viewport.name}.png`);
        },
    );

    test(
        `Watchlist priority and Library match ${viewport.name}`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, 'valid-visual-watchlist');
            await page.setViewportSize(viewport);
            await page.goto(MOVIE_PATH, { waitUntil: 'load' });
            await page.getByRole('button', { name: 'Add to watchlist', exact: true }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toHaveCSS('opacity', '1');
            await settle(page);
            await expect(page).toHaveScreenshot(`watchlist-priority-${viewport.name}.png`);
            await dialog.getByRole('button', { name: 'High', exact: true }).click();
            await expect(dialog).toHaveCount(0);
            await page.goto('/library?tab=watchlist', { waitUntil: 'load' });
            await expect(page.getByRole('table')).toBeVisible();
            await settle(page);
            await expect(page).toHaveScreenshot(`watchlist-populated-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );

    test(
        `Submitted Rating matches ${viewport.name}`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, 'valid-rating-visual-saved');
            await page.setViewportSize(viewport);
            await page.goto(RATING_PATH, { waitUntil: 'load' });
            await page.getByRole('radio', { name: '9 of 10', exact: true }).click();
            await page.getByLabel('Comment', { exact: false }).fill('A lasting impression.');
            await page.getByRole('button', { name: 'Submit Rating', exact: true }).click();
            await expect(page.getByText('Your rating is saved')).toBeVisible();
            await page.evaluate(() => window.scrollTo(0, 0));
            await settle(page);
            await expect(page).toHaveScreenshot(`rating-saved-${viewport.name}.png`, {
                fullPage: true,
            });
        },
    );

    test(
        `Achievement filters match ${viewport.name}`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await authenticate(context, 'valid-visual-achievements-filter');
            await page.setViewportSize(viewport);
            await page.goto('/library?tab=achievements', { waitUntil: 'load' });
            const shelf = page.getByRole('region', { name: 'Achievements', exact: true });
            await shelf.getByRole('button', { name: '1 Unlocked', exact: true }).click();
            await shelf.getByRole('button', { name: '2 In progress', exact: true }).click();
            await shelf.getByRole('button', { name: '3 Not started', exact: true }).click();
            await expect(
                shelf.getByText('No achievements match these filters.', { exact: false }),
            ).toBeVisible();
            await page.evaluate(() => window.scrollTo(0, 0));
            await settle(page);
            await expect(page).toHaveScreenshot(
                `achievements-filtered-empty-${viewport.name}.png`,
                { fullPage: true },
            );
        },
    );
}
