import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { openVisitor } from './visitors';

test('Personal ratings export, preview and import stay private and idempotent through the real API', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const userId = await backend.createUser('CSV viewer');
    const peerId = await backend.createUser('CSV peer');
    const movie = await backend.prisma.movie.create({ data: { title: 'CSV, "Journey"' } });
    const context = await openVisitor(browser, backend, userId);
    try {
        await backend.prisma.personalMovieRating.createMany({
            data: [
                { userId, movieId: movie.id, score: 8, source: 'PERSONAL' },
                { userId: peerId, movieId: movie.id, score: 2, source: 'PERSONAL' },
            ],
        });
        const page = await context.newPage();
        await page.goto('/settings?tab=import-export');
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export ratings', exact: true }).click();
        const download = await downloadPromise;
        const csv = await readFile(await download.path(), 'utf8');
        expect(csv).toContain(',"8"');
        expect(csv).not.toContain(',"2"');
        const changed = csv.replace(',"8"', ',"6"');
        await page.getByLabel('Ratings CSV file').setInputFiles({
            name: 'ratings.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(changed),
        });
        await page.getByRole('button', { name: 'Preview import' }).click();
        await expect(
            page.getByRole('status').filter({ hasText: 'Validation complete.' }),
        ).toContainText('1 changed');
        await page.getByRole('button', { name: 'Confirm import' }).click();
        await expect(
            page.getByRole('status').filter({ hasText: 'Import complete.' }),
        ).toBeVisible();
        const current = await backend.prisma.personalMovieRating.findUniqueOrThrow({
            where: { userId_movieId: { userId, movieId: movie.id } },
        });
        expect(current.score).toBe(6);
        await page.getByRole('button', { name: 'Preview import' }).click();
        await expect(
            page.getByRole('status').filter({ hasText: 'Validation complete.' }),
        ).toContainText('1 unchanged');
        await page.getByRole('button', { name: 'Confirm import' }).click();
        await expect(
            page.getByRole('status').filter({ hasText: 'Import complete.' }),
        ).toBeVisible();
        expect(
            await backend.prisma.personalMovieRating.findUniqueOrThrow({
                where: { userId_movieId: { userId, movieId: movie.id } },
            }),
        ).toEqual(current);
        expect(
            await backend.prisma.personalMovieRating.findUniqueOrThrow({
                where: { userId_movieId: { userId: peerId, movieId: movie.id } },
            }),
        ).toMatchObject({ score: 2 });
    } finally {
        await context.close();
        await backend.removeUsers([userId, peerId]);
        await backend.removeMovies([movie.id]);
        await backend.close();
    }
});
