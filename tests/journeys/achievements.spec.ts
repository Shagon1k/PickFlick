import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { snapshotSessionSettings } from '../../packages/database/src/index.ts';
import { openVisitor } from './visitors';

test('Achievement shelves retain earned history and isolate owners through the real API', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const { prisma } = backend;
    const users = await Promise.all([
        backend.createUser('Achievement owner'),
        backend.createUser('Other owner'),
    ]);
    const clubId = randomUUID();
    const movies = await prisma.movie.createManyAndReturn({
        data: Array.from({ length: 10 }, (_, index) => ({ title: `Achievement film ${index}` })),
    });
    const context = await openVisitor(browser, backend, users[0], {
        viewport: { width: 1440, height: 900 },
    });
    try {
        await prisma.personalMovieRating.createMany({
            data: movies.map((movie) => ({
                userId: users[0],
                movieId: movie.id,
                score: 8,
                source: 'PERSONAL',
            })),
        });
        await prisma.club.create({ data: { id: clubId, name: 'Achievement Club' } });
        const member = await prisma.membership.create({
            data: { id: randomUUID(), userId: users[0], clubId, role: 'ADMIN' },
        });
        const session = await prisma.session.create({
            data: {
                ...(await snapshotSessionSettings(prisma, clubId)),
                id: randomUUID(),
                clubId,
                type: 'PAST',
                phase: 'COMPLETED',
                movieId: movies[0]!.id,
                scheduledAt: new Date(),
            },
        });
        await prisma.sessionParticipant.create({
            data: {
                clubId,
                membershipId: member.id,
                sessionId: session.id,
                status: 'ACCEPTED',
                attended: true,
            },
        });
        const page = await context.newPage();
        await page.goto('/library?tab=achievements');
        const archivist = page.getByRole('article', { name: 'Archivist', exact: true });
        await expect(page.getByRole('article')).toHaveCount(14);
        await expect(archivist.getByText('Unlocked', { exact: true })).toBeVisible();
        await expect(archivist.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
        const before = await prisma.achievementAward.findFirstOrThrow({
            where: { userId: users[0], key: 'archivist' },
        });
        await prisma.personalMovieRating.deleteMany({ where: { userId: users[0] } });
        await page.reload();
        await expect(archivist.getByText('Unlocked', { exact: true })).toBeVisible();
        expect(
            await prisma.achievementAward.findUniqueOrThrow({ where: { id: before.id } }),
        ).toEqual(before);
        await page.goto(`/clubs/${clubId}/achievements`);
        await expect(page.getByRole('article')).toHaveCount(15);
        await expect(
            page
                .getByRole('article', { name: 'First Screening', exact: true })
                .getByText('Unlocked', { exact: true }),
        ).toBeVisible();
        await context.clearCookies();
        await context.addCookies(await backend.cookiesFor(users[1], '127.0.0.1'));
        await page.goto('/library?tab=achievements');
        await expect(archivist.getByText('Not started', { exact: true })).toBeVisible();
        await expect(archivist.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
        await page.goto(`/clubs/${clubId}/achievements`);
        await expect(page.getByRole('heading', { name: 'Club access unavailable' })).toBeVisible();
    } finally {
        await context.close();
        await backend.removeUsers(users);
        await backend.removeMovies(movies.map((movie) => movie.id));
        await backend.close();
    }
});
