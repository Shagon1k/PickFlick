import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { settle } from './settle';

const MOVIE_ID = '10000000-0000-4000-8000-000000000037';

for (const width of [390, 768, 1024, 1440]) {
    test(
        `Movie Details content, links and accessibility at ${width}`,
        { tag: '@smoke' },
        async ({ context, page }) => {
            await page.setViewportSize({ width, height: 900 });
            await context.addCookies([
                {
                    name: 'pickflick.session_token',
                    value: 'valid-movie',
                    domain: '127.0.0.1',
                    path: '/',
                },
            ]);
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
            const ratings = page.getByRole('list', { name: 'Provider ratings' });
            await expect(
                ratings.getByRole('listitem').filter({ hasText: 'KINOPOISK' }),
            ).toContainText('7.5 / 10');
            await expect(ratings.getByRole('listitem').filter({ hasText: 'TMDB' })).toContainText(
                '7.0 / 10',
            );
            await expect(ratings).not.toContainText('7.519');
            await expect(ratings.getByRole('listitem').filter({ hasText: 'IMDB' })).toContainText(
                '7.6 / 10',
            );
            await expect(page.getByRole('link', { name: 'IMDb' })).toHaveAttribute(
                'href',
                'https://www.imdb.com/title/tt1234567/',
            );
            const wikipedia = page.getByRole('link', { name: 'Search Wikipedia' });
            await expect(wikipedia).toHaveAttribute(
                'href',
                `https://en.wikipedia.org/w/index.php?${new URLSearchParams({ search: '<script>alert(1)</script> & Film' })}`,
            );
            await expect(page.getByRole('link', { name: 'Watch trailer' })).toHaveAttribute(
                'rel',
                'noopener noreferrer',
            );
            await expect(page.getByRole('link', { name: 'Related Film 2026' })).toHaveAttribute(
                'href',
                '/movies/10000000-0000-4000-8000-000000000038',
            );
            await expect(
                page
                    .getByText(
                        'This product uses the TMDB API but is not endorsed or certified by TMDB.',
                    )
                    .first(),
            ).toBeVisible();
            await settle(page);
            expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual(
                [],
            );
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({ path: `test-results/movie-${width}.png`, fullPage: true });
            await page.getByRole('link', { name: 'Back to Hub', exact: true }).focus();
            await expect(
                page.getByRole('link', { name: 'Back to Hub', exact: true }),
            ).toBeFocused();
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
        await context.addCookies([
            {
                name: 'pickflick.session_token',
                value: `valid-movie-${state}`,
                domain: '127.0.0.1',
                path: '/',
            },
        ]);
        await page.route('**/api/movies/images/**', (route) => route.abort());
        await page.goto(`/movies/${MOVIE_ID}`);
        await expect(page.getByText(message, { exact: false }).first()).toBeVisible();
    });
}

test('missing media and identifiers omit unavailable links; broken poster becomes a placeholder', async ({
    context,
    page,
}) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-movie-missing',
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
    await page.goto(`/movies/${MOVIE_ID}`);
    await expect(page.getByText('Poster unavailable')).toBeVisible();
    await expect(page.getByText('No trailer is available.')).toBeVisible();
    await expect(page.getByText('No related titles are available.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'IMDb' })).toHaveCount(0);
    await context.addCookies([
        { name: 'pickflick.session_token', value: 'valid-movie', domain: '127.0.0.1', path: '/' },
    ]);
    await page.route('**/api/movies/images/**', (route) => route.abort());
    await page.reload();
    await expect(page.getByText('Poster unavailable').first()).toBeVisible();
});

test('unknown or malformed Movie identity uses safe recovery; related failure preserves the main film', async ({
    context,
    page,
}) => {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-movie-not-found',
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
    await page.goto(`/movies/${MOVIE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reel Not Found');
    await page.goto('/movies/100');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reel Not Found');
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-movie-related-unavailable',
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
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
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-movie-missing',
            domain: '127.0.0.1',
            path: '/',
        },
    ]);
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
