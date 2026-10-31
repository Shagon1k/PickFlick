import { expect, test } from '@playwright/test';

import { buildDetailsCacheKey } from '../../apps/backend/src/modules/movies/catalog-cache-key.ts';
import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { buildCanonicalDetails } from '../../apps/backend/src/testing/movie-fixtures.ts';
import { loadRuntimeEnvironment } from '../../packages/config/src/environment.ts';
import { openVisitor } from './visitors';

test('Watchlist persists from Movie to Library and back through the real API', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const environment = loadRuntimeEnvironment();
    const { prisma } = backend;
    const userId = await backend.createUser('Watchlist viewer');
    const movie = await prisma.movie.create({
        data: { title: 'Watchlist journey', releaseYear: 2024 },
    });
    const context = await openVisitor(browser, backend, userId);
    try {
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
        await page.goto(`/movies/${movie.id}`);
        await page.getByRole('button', { name: 'Add to watchlist', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('button', { name: 'Medium', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await dialog.getByRole('button', { name: 'High', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await page.goto('/library?tab=watchlist');
        const row = page
            .getByRole('row')
            .filter({ has: page.getByRole('link', { name: 'Watchlist journey', exact: true }) });
        await expect(row.getByRole('button', { name: 'Edit watchlist priority' })).toHaveText(
            'High',
        );
        await row.getByRole('button', { name: 'Edit watchlist priority' }).click();
        await dialog.getByRole('button', { name: 'Low', exact: true }).click();
        await expect(row.getByRole('button', { name: 'Edit watchlist priority' })).toHaveText(
            'Low',
        );
        const original = await prisma.watchlistItem.findUniqueOrThrow({
            where: { userId_movieId: { userId, movieId: movie.id } },
        });
        expect(original.priority).toBe('LOW');
        const retries = await Promise.all(
            [0, 1, 2].map(() =>
                context.request.put(`/api/movies/${movie.id}/watchlist`, {
                    data: { priority: 'LOW' },
                }),
            ),
        );
        expect(retries.map((response) => response.status())).toEqual([200, 200, 200]);
        expect(await prisma.watchlistItem.findMany({ where: { userId } })).toEqual([original]);
        await row.getByRole('link').click();
        await expect(page).toHaveURL(new RegExp(`/movies/${movie.id}$`, 'u'));
        await page.reload();
        await page.getByRole('button', { name: 'Edit watchlist priority', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Low', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await dialog.getByRole('button', { name: 'Remove from watchlist' }).click();
        await expect(
            page.getByRole('button', { name: 'Add to watchlist', exact: true }),
        ).toBeVisible();
        await page.goto('/library?tab=watchlist');
        await expect(page.getByText('Your Watchlist is empty.', { exact: false })).toBeVisible();
        expect(await prisma.watchlistItem.findMany({ where: { userId } })).toEqual([]);
    } finally {
        await context.close();
        await backend.removeUsers([userId]);
        await backend.removeMovies([movie.id]);
        await backend.close();
    }
});
