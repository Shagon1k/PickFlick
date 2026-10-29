import { type BrowserContext, expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
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
        name: 'watching-operator',
        path: WATCHING_PATH,
        token: 'valid-watching-visual',
        ready: 'Room A',
    },
    {
        name: 'rating-form',
        path: RATING_PATH,
        token: 'valid-rating-visual',
        ready: 'Submit Rating',
    },
    {
        name: 'completed-history',
        path: RATING_PATH,
        token: 'valid-rating-history-completed',
        ready: 'Nomination Rivals',
    },
    {
        name: 'hub-history',
        path: `${CLUB_PATH}/sessions`,
        token: 'valid-hub-history',
        ready: 'History',
    },
    {
        name: 'club-ratings-populated',
        path: `${CLUB_PATH}/ratings`,
        token: 'valid-hub-ratings-pro-visual',
        ready: 'Synthetic film 28',
    },
    {
        name: 'library-ratings',
        path: '/library',
        token: 'valid-library-visual',
        ready: '28 films rated',
    },
    {
        name: 'achievements-library',
        path: '/library?tab=achievements',
        token: 'valid-visual-achievements',
        ready: 'First Screening',
    },
];

async function authenticate(context: BrowserContext, token: string) {
    await signInMock(context, `${token}-phase-visual-${crypto.randomUUID()}`);
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

    test(
        `Personal Rating editor matches ${viewport.name}`,
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
}
