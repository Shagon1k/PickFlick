import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { loadRuntimeEnvironment } from '../../packages/config/src/environment.ts';
import {
    createDatabaseClient,
    snapshotSessionSettings,
} from '../../packages/database/src/index.ts';

test('participants nominate through the real API, submit complete ballots and keep immutable scores', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const prisma = createDatabaseClient(loadRuntimeEnvironment().databaseUrl);
    const userIds: string[] = [];
    const movieIds: string[] = [];
    const contexts = [];
    const clubId = randomUUID();
    try {
        const adminId = await backend.createUser('Selection Admin');
        const memberId = await backend.createUser('Selection Member');
        userIds.push(adminId, memberId);
        await prisma.club.create({
            data: {
                id: clubId,
                name: 'Selection Journey',
                selectionScaleMin: 0,
                selectionScaleMax: 10,
            },
        });
        const adminMembership = (
            await prisma.membership.create({
                data: { id: randomUUID(), clubId, userId: adminId, role: 'ADMIN' },
            })
        ).id;
        const memberMembership = (
            await prisma.membership.create({
                data: { id: randomUUID(), clubId, userId: memberId, role: 'MEMBER' },
            })
        ).id;
        const session = await prisma.session.create({
            data: {
                id: randomUUID(),
                clubId,
                ...(await snapshotSessionSettings(prisma, clubId)),
                type: 'FULL_CYCLE',
                phase: 'NOMINATION',
                topic: 'Selection journey',
            },
        });
        for (const membershipId of [adminMembership, memberMembership])
            await prisma.sessionParticipant.create({
                data: { sessionId: session.id, clubId, membershipId, status: 'ACCEPTED' },
            });
        const query = `selection-journey-${randomUUID()}`;
        const movies = [
            { id: randomUUID(), title: 'Journey Movie One', releaseYear: 2020 },
            { id: randomUUID(), title: 'Journey Movie Two', releaseYear: 2021 },
        ];
        movieIds.push(...movies.map((movie) => movie.id));
        await backend.seedMovieSearch(query, movies);
        const pages = [];
        for (const [index, userId] of [adminId, memberId].entries()) {
            const context = await browser.newContext({
                extraHTTPHeaders: {
                    'x-forwarded-for': `2001:db8:${randomUUID().slice(0, 4)}:${index}::1`,
                },
            });
            contexts.push(context);
            await context.addCookies(await backend.cookiesFor(userId, '127.0.0.1'));
            const response = await context.request.post(`/api/sessions/${session.id}/nominations`, {
                data: { movieId: movies[index]!.id },
            });
            expect(response.status()).toBe(201);
            pages.push(await context.newPage());
        }
        for (const [index, page] of pages.entries()) {
            await page.goto(`/sessions/${session.id}`);
            await expect(page.getByRole('heading', { name: 'Movie Selection' })).toBeVisible({
                timeout: 20000,
            });
            const groups = page.getByRole('radiogroup');
            await expect(groups).toHaveCount(2);
            await groups
                .first()
                .getByRole('radio', { name: `${index} of 10`, exact: true })
                .click();
            await groups.nth(1).getByRole('radio', { name: '10 of 10' }).click();
            await page.getByRole('button', { name: 'Submit scores' }).click();
            await expect(
                page.getByText('Your ballot is saved. Your scores are locked.'),
            ).toBeVisible();
            await page.reload();
            await expect(page.getByRole('radio')).toHaveCount(0);
            await expect(page.getByText(`${index} of 10`, { exact: true })).toBeVisible();
        }
        await expect(
            pages[0]!.getByText('Selection in progress — 2 of 2 participants have submitted.'),
        ).toBeVisible({ timeout: 20000 });
    } finally {
        for (const context of contexts) await context.close();
        await prisma.selectionScore.deleteMany({ where: { ballot: { session: { clubId } } } });
        await prisma.selectionBallot.deleteMany({ where: { session: { clubId } } });
        await prisma.nomination.deleteMany({ where: { session: { clubId } } });
        await prisma.sessionParticipant.deleteMany({ where: { clubId } });
        await prisma.session.deleteMany({ where: { clubId } });
        await prisma.membership.deleteMany({ where: { clubId } });
        await prisma.club.deleteMany({ where: { id: clubId } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.movieSearchCache.deleteMany({
            where: {
                OR: movieIds.map((id) => ({
                    data: { path: ['movies'], array_contains: [{ id }] },
                })),
            },
        });
        await prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
        await prisma.$disconnect();
        await backend.close();
    }
});
