import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { buildDetailsCacheKey } from '../../apps/backend/src/modules/movies/catalog-cache-key.ts';
import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { buildCanonicalDetails } from '../../apps/backend/src/testing/movie-fixtures.ts';
import { loadRuntimeEnvironment } from '../../packages/config/src/environment.ts';
import { snapshotSessionSettings } from '../../packages/database/src/index.ts';
import { openVisitor } from './visitors';

test('A Session Rating becomes an editable personal opinion while Completed history stays unchanged', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const environment = loadRuntimeEnvironment();
    const { prisma } = backend;
    const userId = await backend.createUser('Personal Rating viewer');
    const clubId = randomUUID();
    const movie = await prisma.movie.create({ data: { title: 'Personal Rating screening' } });
    const context = await openVisitor(browser, backend, userId);
    try {
        await prisma.club.create({ data: { id: clubId, name: 'Personal Rating Journey' } });
        const membership = await prisma.membership.create({
            data: { id: randomUUID(), clubId, userId, role: 'ADMIN' },
        });
        const session = await prisma.session.create({
            data: {
                id: randomUUID(),
                clubId,
                movieId: movie.id,
                type: 'PRE_SELECTED',
                phase: 'RATING',
                ...(await snapshotSessionSettings(prisma, clubId)),
            },
        });
        await prisma.sessionParticipant.create({
            data: {
                sessionId: session.id,
                clubId,
                membershipId: membership.id,
                status: 'ACCEPTED',
            },
        });
        const fetchedAt = new Date();
        const data = {
            ...buildCanonicalDetails(100, fetchedAt.toISOString(), movie.id),
            posterUrl: null,
            title: movie.title,
        };
        await prisma.movieDetailsCache.create({
            data: {
                movieId: movie.id,
                key: buildDetailsCacheKey(environment.catalog.provider, environment.catalog.locale),
                fetchedAt,
                data,
            },
        });
        const page = await context.newPage();
        await page.goto(`/sessions/${session.id}`);
        await page.getByRole('radio', { name: '8 of 10' }).click();
        await page.getByRole('button', { name: 'Submit Rating' }).click();
        await expect(page.getByText('completed', { exact: true })).toBeVisible();
        const historical = await prisma.sessionRating.findFirstOrThrow({
            where: { sessionId: session.id },
        });
        await page.goto(`/movies/${movie.id}`);
        await page.getByRole('button', { name: 'Your rating: 8 out of 10. Edit rating' }).click();
        const dialog = page.getByRole('dialog', { name: /^(?:Rate this film|Your rating:)/u });
        await dialog.getByRole('radio', { name: '4 of 10' }).click();
        // Choosing a star saves it.
        await expect(dialog.getByText('Personal Rating saved.')).toBeAttached();
        await page.reload();
        await expect(
            page.getByRole('button', { name: 'Your rating: 4 out of 10. Edit rating' }),
        ).toBeVisible();
        const retry = await context.request.post(`/api/sessions/${session.id}/rating`, {
            data: { score: 8 },
        });
        expect(retry.status()).toBe(201);
        expect(
            await prisma.personalMovieRating.findUniqueOrThrow({
                where: { userId_movieId: { userId, movieId: movie.id } },
            }),
        ).toMatchObject({ score: 4, source: 'PERSONAL' });
        expect(
            await prisma.sessionRating.findUniqueOrThrow({ where: { id: historical.id } }),
        ).toEqual(historical);
        await page.goto(`/sessions/${session.id}`);
        await expect(page.getByRole('heading', { name: 'Individual Ratings' })).toBeVisible();
        await expect(
            page
                .getByRole('region', { name: 'Your rating', exact: true })
                .getByRole('list')
                .getByText('8/10', { exact: true }),
        ).toBeVisible();
    } finally {
        await context.close();
        await backend.removeUsers([userId]);
        await backend.removeMovies([movie.id]);
        await backend.close();
    }
});
