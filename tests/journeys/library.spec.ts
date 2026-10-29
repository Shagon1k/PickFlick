import { expect, test } from '@playwright/test';

import { buildDetailsCacheKey } from '../../apps/backend/src/modules/movies/catalog-cache-key.ts';
import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { buildCanonicalDetails } from '../../apps/backend/src/testing/movie-fixtures.ts';
import { loadRuntimeEnvironment } from '../../packages/config/src/environment.ts';
import { openVisitor } from './visitors';

test('Library filters, pages and Movie mutations persist through the real API', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const environment = loadRuntimeEnvironment();
    const { prisma } = backend;
    const userId = await backend.createUser('Library viewer');
    const otherUserId = await backend.createUser('Other viewer');
    const movies = await prisma.movie.createManyAndReturn({
        data: Array.from({ length: 28 }, (_, index) => ({
            title: `Library journey ${String(index).padStart(2, '0')}`,
            releaseYear: 2024,
        })),
    });
    const movie = movies.find((item) => item.title === 'Library journey 00')!;
    const context = await openVisitor(browser, backend, userId, {
        viewport: { width: 1440, height: 900 },
    });
    try {
        await prisma.personalMovieRating.createMany({
            data: movies.map((item) => ({
                userId,
                movieId: item.id,
                score: 8,
                source: 'PERSONAL',
            })),
        });
        await prisma.watchlistItem.createMany({
            data: movies.map((item) => ({ userId, movieId: item.id, priority: 'HIGH' })),
        });
        await prisma.personalMovieRating.create({
            data: { userId: otherUserId, movieId: movie.id, score: 2, source: 'PERSONAL' },
        });
        const fetchedAt = new Date();
        await prisma.movieDetailsCache.create({
            data: {
                movieId: movie.id,
                key: buildDetailsCacheKey(environment.catalog.provider, environment.catalog.locale),
                fetchedAt,
                data: {
                    ...buildCanonicalDetails(100, fetchedAt.toISOString(), movie.id),
                    title: movie.title,
                    posterUrl: null,
                },
            },
        });
        const page = await context.newPage();
        await page.goto('/library?sort=title');
        await expect(page.getByRole('row')).toHaveCount(26);
        const statistics = page.getByRole('region', { name: 'Personal statistics', exact: true });
        await expect(statistics.locator('dd')).toHaveText([
            '28',
            '28',
            '8',
            '—',
            '28',
            '—',
            '—',
            '—',
        ]);
        await page.getByRole('link', { name: 'Next', exact: true }).click();
        await expect(page.getByText('Page 2 of 2')).toBeVisible();
        await expect(page.getByRole('row')).toHaveCount(4);
        await page.getByLabel('Search rated films').fill('Library journey 00');
        await page.getByRole('combobox', { name: 'Rating', exact: true }).click();
        await page.getByRole('option', { name: '8/10', exact: true }).click();
        await page.getByRole('button', { name: 'Apply', exact: true }).click();
        await expect(page.getByRole('row')).toHaveCount(2);
        await expect(statistics.locator('dd').first()).toHaveText('28');
        await expect(page.getByText('Page 1 of 1')).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Search rated films')).toHaveValue('Library journey 00');
        await page.getByRole('button', { name: 'Your rating: 8 out of 10. Edit rating' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('radio', { name: '9 of 10', exact: true }).click();
        await dialog.getByRole('button', { name: 'Save rating', exact: true }).click();
        await expect(
            page.getByText('No films match your search or filters.', { exact: false }),
        ).toBeVisible();
        await expect(page.getByRole('heading', { name: 'My Ratings', exact: true })).toBeFocused();
        await page.goto(`/movies/${movie.id}`);
        await expect(
            page.getByRole('button', { name: 'Your rating: 9 out of 10. Edit rating' }),
        ).toBeVisible();
        await page.goto('/library?tab=watchlist&q=Library+journey+00&priority=HIGH');
        await expect(statistics.locator('dd').nth(4)).toHaveText('28');
        await page.getByRole('button', { name: 'Edit watchlist priority' }).click();
        await dialog.getByRole('button', { name: 'Low', exact: true }).click();
        await expect(
            page.getByText('No films match your search or filters.', { exact: false }),
        ).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Watchlist', exact: true })).toBeFocused();
        await page.getByRole('link', { name: 'Clear', exact: true }).click();
        await expect(page.getByRole('row')).toHaveCount(26);
        await page.getByRole('link', { name: 'Next', exact: true }).click();
        const row = page
            .getByRole('row')
            .filter({ has: page.getByRole('link', { name: 'Library journey 00', exact: true }) });
        await expect(row.getByRole('button', { name: 'Edit watchlist priority' })).toHaveText(
            'Low',
        );
        await expect(page.getByRole('row')).toHaveCount(4);
        expect(
            await prisma.personalMovieRating.findUnique({
                where: { userId_movieId: { userId: otherUserId, movieId: movie.id } },
            }),
        ).toMatchObject({ score: 2 });
    } finally {
        await context.close();
        await backend.removeUsers([userId, otherUserId]);
        await backend.removeMovies(movies.map((item) => item.id));
        await backend.close();
    }
});
