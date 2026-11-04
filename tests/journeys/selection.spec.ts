import { randomUUID } from 'node:crypto';

import { sessionSchema } from '@pickflick/contracts';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { selectionResultSchema } from '../../apps/backend/src/modules/sessions/selection/selection-result.ts';
import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { snapshotSessionSettings } from '../../packages/database/src/index.ts';
import { openVisitor } from './visitors';

async function submitScores(page: Page, sessionId: string, score: number) {
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole('heading', { name: 'Movie Selection' })).toBeVisible({
        timeout: 20000,
    });
    const groups = page.getByRole('radiogroup');
    await expect(groups).toHaveCount(2);
    await groups
        .first()
        .getByRole('radio', { name: `${score} of 10`, exact: true })
        .click();
    await groups.nth(1).getByRole('radio', { name: '10 of 10' }).click();
    await page.getByRole('button', { name: 'Submit scores' }).click();
}

test('Club members join by the shared link, nominate, submit immutable ballots and select a winner', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const { prisma } = backend;
    const userIds: string[] = [];
    const movieIds: string[] = [];
    const contexts: BrowserContext[] = [];
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
                showSelectionScoresDuring: false,
                showNominationAuthorsDuring: true,
            },
        });
        await prisma.membership.create({
            data: { id: randomUUID(), clubId, userId: adminId, role: 'ADMIN' },
        });
        await prisma.membership.create({
            data: { id: randomUUID(), clubId, userId: memberId, role: 'MEMBER' },
        });
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
        const query = `selection-journey-${randomUUID()}`;
        const movies = [
            { id: randomUUID(), title: 'Journey Movie One', releaseYear: 2020 },
            { id: randomUUID(), title: 'Journey Movie Two', releaseYear: 2021 },
        ];
        movieIds.push(...movies.map((movie) => movie.id));
        await backend.seedMovieSearch(query, movies);
        const pages = [];
        for (const userId of [adminId, memberId]) {
            const context = await openVisitor(browser, backend, userId);
            contexts.push(context);
            const page = await context.newPage();
            pages.push(page);
            await page.goto(`/sessions/${session.id}`);
            await page.getByRole('button', { name: 'Join Session', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Leave Session' })).toBeVisible();
        }
        for (const [index, context] of contexts.entries()) {
            const response = await context.request.post(`/api/sessions/${session.id}/nominations`, {
                data: { movieId: movies[index]!.id },
            });
            expect(response.status()).toBe(201);
        }
        const firstPage = pages[0]!;
        await pages[1]!.goto(`/sessions/${session.id}`);
        await expect(
            pages[1]!.getByRole('status').filter({
                hasText: /^Selection in progress — 0 of 2 participants have submitted\.$/u,
            }),
        ).toBeVisible();
        await submitScores(firstPage, session.id, 0);
        await expect(
            firstPage
                .getByRole('status')
                .filter({ hasText: /^Submitted · Waiting for other participants$/u }),
        ).toBeVisible();
        await expect(
            pages[1]!.getByRole('status').filter({
                hasText: /^Selection in progress — 1 of 2 participants have submitted\.$/u,
            }),
        ).toBeVisible({ timeout: 20000 });
        await firstPage.reload();
        await expect(firstPage.getByRole('radio')).toHaveCount(0);
        await expect(
            firstPage.getByRole('group', { name: 'Score for Journey Movie One', exact: true }),
        ).toContainText('Submitted: 0 of 10');
        await contexts[0]!.setOffline(true);
        await submitScores(pages[1]!, session.id, 1);
        await expect(
            pages[1]!.getByText('Watching', { exact: true }).filter({ visible: true }).first(),
        ).toBeVisible();
        await contexts[0]!.setOffline(false);
        await firstPage.evaluate(() => window.dispatchEvent(new Event('online')));
        for (const page of pages) {
            await expect(
                page.getByText('Watching', { exact: true }).filter({ visible: true }).first(),
            ).toBeVisible({
                timeout: 20000,
            });
            await expect(page.getByRole('link', { name: 'View selected Movie' })).toHaveAttribute(
                'href',
                `/movies/${movies[1]!.id}`,
            );
        }
        // Scores stay private for both roles; nomination authors have their own setting.
        for (const page of pages) {
            const rivals = page.getByRole('region', { name: 'Nomination Rivals', exact: true });
            await expect(rivals.getByRole('listitem')).toHaveCount(2);
            await expect(rivals.getByText('by Selection Admin', { exact: true })).toBeVisible();
            await expect(rivals.getByText('by Selection Member', { exact: true })).toBeVisible();
            await expect(
                rivals.getByRole('button', { name: /^Average Selection score/u }),
            ).toHaveCount(0);
            await expect(page.getByRole('table', { name: /^Selection scores/u })).toHaveCount(0);
        }
        const readOutcome = async () =>
            sessionSchema.parse(
                await (await contexts[0]!.request.get(`/api/sessions/${session.id}`)).json(),
            ).selectionOutcome;
        const saved = await readOutcome();
        expect(saved).toMatchObject({ source: 'LIVE', breakdown: null });
        const readSnapshot = async () =>
            selectionResultSchema.parse(
                (await prisma.session.findUniqueOrThrow({ where: { id: session.id } }))
                    .selectionResult,
            );
        const snapshot = await readSnapshot();
        expect(snapshot).toMatchObject({ reason: 'TOTAL', movieId: movies[1]!.id });
        expect(snapshot.inputs.ballots).toHaveLength(2);
        const retry = await contexts[0]!.request.post(
            `/api/sessions/${session.id}/selection/close`,
            {
                data: { confirmation: 'CLOSE', phaseVersion: 1 },
            },
        );
        expect(retry.status()).toBe(201);
        expect(await readOutcome()).toEqual(saved);
        expect(await readSnapshot()).toEqual(snapshot);
        await pages[1]!.reload();
        await expect(
            pages[1]!.getByText('Watching', { exact: true }).filter({ visible: true }).first(),
        ).toBeVisible();
        await expect(
            pages[1]!.getByRole('region', { name: 'Nomination Rivals' }).getByRole('listitem'),
        ).toHaveCount(2);
    } finally {
        for (const context of contexts) await context.close();
        await backend.removeUsers(userIds);
        await backend.removeMovies(movieIds);
        await backend.close();
    }
});
