import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInMock } from './mock-session';
import { settle } from './settle';
import { screenshotViewports } from './viewports';

const MOVIE_ID = '10000000-0000-4000-8000-000000000037';

for (const width of [390, 768, 1024, 1440]) {
    test(
        `Movie Details content, links and accessibility at ${width}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await page.setViewportSize({ width, height: 900 });
            await signInMock(context, 'valid-movie');
            await page.route('**/api/movies/images/**', (route) =>
                route.fulfill({
                    status: 200,
                    contentType: 'image/png',
                    body: Buffer.from(
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                        'base64',
                    ),
                }),
            );
            await page.goto(`/movies/${MOVIE_ID}`, { waitUntil: 'load' });
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(
                '<script>alert(1)</script> & Film',
            );
            // One rating: IMDb wins over Kinopoisk and TMDB, rounded to one decimal.
            await expect(page.getByTitle('IMDb rating')).toHaveText(
                'IMDb rating7.6 out of 10 431K ratings',
            );
            await expect(page.getByText('7.519')).toHaveCount(0);
            await expect(page.locator('[title$=" rating"]')).toHaveCount(1);
            // Personal Ratings and Watchlist use the shared editors.
            await expect(page.getByRole('button', { name: 'Rate this film' })).toBeEnabled();
            // The ribbon sits on the visible poster: the media grid's, or the phone ticket's.
            await expect(
                page.getByRole('button', { name: 'Add to watchlist' }).filter({ visible: true }),
            ).toBeEnabled();
            await expect(page.getByRole('link', { name: 'IMDb' })).toHaveAttribute(
                'href',
                'https://www.imdb.com/title/tt1234567/',
            );
            await expect(page.getByRole('link', { name: /^Kinopoisk/u })).toHaveAttribute(
                'href',
                'https://www.kinopoisk.ru/film/258687/',
            );
            await expect(page.getByRole('link', { name: /^Letterboxd/u })).toHaveAttribute(
                'href',
                'https://letterboxd.com/imdb/tt1234567/',
            );
            const wikipedia = page.getByRole('link', { name: /^Wikipedia search/u });
            await expect(wikipedia).toHaveAttribute(
                'href',
                `https://en.wikipedia.org/w/index.php?${new URLSearchParams({ search: '<script>alert(1)</script> & Film' })}`,
            );
            // Nothing reaches YouTube until Play; then the privacy-enhanced player loads in place.
            await page.route('https://www.youtube-nocookie.com/**', (route) =>
                route.fulfill({
                    body: '<!doctype html><title>Player</title>',
                    contentType: 'text/html',
                }),
            );
            await expect(page.locator('iframe')).toHaveCount(0);
            await page.getByRole('button', { name: 'Play Watch trailer' }).click();
            await expect(page.locator('iframe')).toHaveAttribute(
                'src',
                'https://www.youtube-nocookie.com/embed/abc123XYZ-_?autoplay=1&rel=0',
            );
            await expect(page.getByRole('link', { name: 'Related Film 2026' })).toHaveAttribute(
                'href',
                '/movies/10000000-0000-4000-8000-000000000038',
            );
            // Provider attribution lives with search, not on Movie Details (#89 places it for launch).
            await expect(
                page.getByRole('complementary', { name: 'Movie catalog credits' }),
            ).toHaveCount(0);
            await settle(page);
            // The YouTube player document is not ours to audit.
            expect(
                (await new AxeBuilder({ page }).include('main').exclude('iframe').analyze())
                    .violations,
            ).toEqual([]);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({ path: `test-results/movie-${width}.png`, fullPage: true });
            await expect(page.getByRole('heading', { name: 'You may also like' })).toBeVisible();
            await expect(page.getByRole('img', { name: 'TMDB', exact: true })).toHaveCount(0);
            await page.getByRole('link', { name: /^Wikipedia search/u }).focus();
            await expect(page.getByRole('link', { name: /^Wikipedia search/u })).toBeFocused();
        },
    );
}

for (const [state, message] of [
    ['missing', 'No synopsis is available in English.'],
    ['stale', 'Showing cached details while the provider is unavailable.'],
    ['partial', 'Some provider details are unavailable.'],
    ['outage', 'The film provider is temporarily unavailable.'],
    ['limited', 'Film details are busy.'],
    ['disabled', 'Film details are not configured yet.'],
] as const) {
    test(`Movie Details ${state} state`, { tag: '@smoke' }, async ({ context, page }) => {
        await signInMock(context, `valid-movie-${state}`);
        await page.route('**/api/movies/images/**', (route) => route.abort());
        await page.goto(`/movies/${MOVIE_ID}`);
        await expect(page.getByText(message, { exact: false }).first()).toBeVisible();
    });
}

test('missing media and identifiers omit unavailable links; broken poster becomes a placeholder', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-movie-missing');
    await page.goto(`/movies/${MOVIE_ID}`);
    // The film's own poster: related titles stream in with placeholders of their own, and the phone
    // ticket keeps a hidden one.
    const hero = page.locator('section[aria-labelledby="movie-title"]');
    await expect(hero.getByText('Poster unavailable').filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Our film sources have no trailer for this Movie.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Search YouTube for a trailer/u })).toHaveAttribute(
        'href',
        /^https:\/\/www\.youtube\.com\/results\?search_query=/u,
    );
    await expect(page.getByText('No related titles are available.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'IMDb' })).toHaveCount(0);
    await signInMock(context, 'valid-movie');
    await page.route('**/api/movies/images/**', (route) => route.abort());
    await page.reload();
    await expect(hero.getByText('Poster unavailable').filter({ visible: true })).toBeVisible();
});

test('unknown or malformed Movie identity uses safe recovery; related failure preserves the main film', async ({
    context,
    page,
}) => {
    await signInMock(context, 'valid-movie-not-found');
    await page.goto(`/movies/${MOVIE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reel Not Found');
    await page.goto('/movies/100');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reel Not Found');
    await signInMock(context, 'valid-movie-related-unavailable');
    await page.route('**/api/movies/images/**', (route) => route.abort());
    await page.goto(`/movies/${MOVIE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        '<script>alert(1)</script> & Film',
    );
    await expect(page.getByRole('link', { name: 'Related film unavailable' })).toBeVisible();
});

test('desktop credits and synopsis share the row equally below the media', async ({
    context,
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInMock(context, 'valid-movie-missing');
    await page.goto(`/movies/${MOVIE_ID}`, { waitUntil: 'load' });
    await settle(page);
    const credits = await page.getByRole('region', { name: 'Credits', exact: true }).boundingBox();
    const synopsis = await page.getByRole('region', { name: 'Synopsis' }).boundingBox();
    const trailer = await page.getByRole('region', { name: 'Trailer' }).boundingBox();
    expect(credits).not.toBeNull();
    expect(synopsis).not.toBeNull();
    expect(trailer).not.toBeNull();
    expect(credits?.width).toBe(synopsis?.width);
    expect(synopsis?.x).toBeGreaterThan(credits!.x + credits!.width);
    expect(credits?.y).toBeGreaterThan(trailer!.y + trailer!.height);
    expect(trailer!.width / trailer!.height).toBeCloseTo(16 / 9, 1);
});

for (const viewport of screenshotViewports) {
    test(
        `Movie Details matches the ${viewport.name} prototype composition`,
        { tag: '@visual' },
        async ({ context, page }) => {
            await signInMock(context, 'valid-movie');
            await page.setViewportSize(viewport);
            await page.goto(`/movies/${MOVIE_ID}`, { waitUntil: 'load' });
            await settle(page);
            await expect(page).toHaveScreenshot(`movie-details-${viewport.name}.png`, {
                fullPage: true,
                animations: 'disabled',
                caret: 'hide',
                scale: 'css',
            });
        },
    );
}
