import { randomUUID } from 'node:crypto';

import { type Browser, type BrowserContext, expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { snapshotSessionSettings } from '../../packages/database/src/index.ts';
import { openVisitor } from './visitors';

async function createRatingJourney(browser: Browser) {
    const backend = await connectJourneyBackend();
    const { prisma } = backend;
    const clubId = randomUUID();
    const users: string[] = [];
    const contexts: BrowserContext[] = [];
    const movie = await prisma.movie.create({ data: { title: 'Rating journey screening' } });
    await prisma.club.create({ data: { id: clubId, name: 'Rating Journey' } });
    const session = await prisma.session.create({
        data: {
            id: randomUUID(),
            clubId,
            type: 'PRE_SELECTED',
            phase: 'RATING',
            movieId: movie.id,
            scheduledAt: new Date('2026-12-01T20:00:00Z'),
            location: 'Screening room',
            ...(await snapshotSessionSettings(prisma, clubId)),
        },
    });
    async function cleanup() {
        for (const context of contexts) await context.close();
        await backend.removeUsers(users);
        await backend.removeMovies([movie.id]);
        await backend.close();
    }
    try {
        for (const role of ['ADMIN', 'MODERATOR', 'MEMBER'] as const) {
            const userId = await backend.createUser(`Rating ${role}`);
            users.push(userId);
            const membership = await prisma.membership.create({
                data: { id: randomUUID(), clubId, userId, role },
            });
            await prisma.sessionParticipant.create({
                data: {
                    sessionId: session.id,
                    clubId,
                    membershipId: membership.id,
                    status: 'ACCEPTED',
                },
            });
            contexts.push(await openVisitor(browser, backend, userId));
        }
        const pages = await Promise.all(contexts.map((context) => context.newPage()));
        for (const page of pages) {
            await page.goto(`/sessions/${session.id}`);
            await expect(page.getByText('rating', { exact: true })).toBeVisible();
        }
        return { session, prisma, contexts, pages, cleanup };
    } catch (error) {
        await cleanup();
        throw error;
    }
}

test('Three participants submit once and all clients see automatic completion', async ({
    browser,
}) => {
    const journey = await createRatingJourney(browser);
    const { session, prisma, contexts, pages } = journey;
    try {
        const memberPage = pages[2]!;
        await expect(memberPage.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
        await memberPage.getByRole('radio', { name: '7 of 10' }).click();
        await memberPage.getByLabel('Comment').fill('Remember this screening.');
        await memberPage.getByRole('button', { name: 'Submit Rating' }).click();
        await expect(memberPage.getByText('Your rating is saved')).toBeVisible();
        await expect(pages[0]!.getByText(/Rating in progress — 1 of 3/)).toBeVisible({
            timeout: 20000,
        });
        const duplicates = await Promise.all(
            Array.from({ length: 3 }, () =>
                contexts[2]!.request.post(`/api/sessions/${session.id}/rating`, {
                    data: { score: 7, comment: 'Remember this screening.' },
                }),
            ),
        );
        expect(duplicates.map((response) => response.status())).toEqual([201, 201, 201]);
        for (const page of pages.slice(0, 2)) {
            await page.getByRole('radio', { name: '9 of 10' }).click();
            await page.getByRole('button', { name: 'Submit Rating' }).click();
            await expect(page.getByText('Your rating is saved')).toBeVisible();
        }
        for (const page of pages) {
            await expect(page.getByText('completed', { exact: true })).toBeVisible({
                timeout: 20000,
            });
            await expect(page.getByRole('heading', { name: 'Individual Ratings' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Submit Rating' })).toHaveCount(0);
        }
        await expect(pages[1]!.getByRole('heading', { level: 1 })).toBeFocused();
        const ratings = await prisma.sessionRating.findMany({ where: { sessionId: session.id } });
        const completions = await prisma.sessionProgressEvent.findMany({
            where: { sessionId: session.id, phase: 'COMPLETED' },
        });
        expect(ratings).toHaveLength(3);
        expect(completions).toHaveLength(1);
        await memberPage.reload();
        await expect(memberPage.getByText('Your rating is saved')).toBeVisible();
    } finally {
        await journey.cleanup();
    }
});

test('A Moderator completes partial Rating and every client keeps only received responses', async ({
    browser,
}) => {
    const journey = await createRatingJourney(browser);
    const { session, prisma, contexts, pages } = journey;
    try {
        const memberPage = pages[2]!;
        await memberPage.getByRole('radio', { name: '6 of 10' }).click();
        await memberPage.getByRole('button', { name: 'Submit Rating' }).click();
        await expect(memberPage.getByText('Your rating is saved')).toBeVisible();
        const before = await prisma.sessionRating.findMany({ where: { sessionId: session.id } });
        const operatorPage = pages[1]!;
        await expect(operatorPage.getByText(/Rating in progress — 1 of 3/)).toBeVisible({
            timeout: 20000,
        });
        await operatorPage.getByRole('button', { name: 'Session settings' }).click();
        await expect(
            operatorPage.getByRole('menuitem', { name: 'Close Rating early' }),
        ).toBeFocused();
        await operatorPage.keyboard.press('Enter');
        const dialog = operatorPage.getByRole('dialog', { name: 'Close Rating early' });
        await dialog.getByLabel('Type CLOSE to confirm').fill('CLOSE');
        await dialog.getByRole('button', { name: 'Complete Session' }).click();
        await expect(dialog).toHaveCount(0);
        for (const page of pages)
            await expect(page.getByText('completed', { exact: true })).toBeVisible({
                timeout: 20000,
            });
        const retry = await contexts[0]!.request.post(`/api/sessions/${session.id}/rating/close`, {
            data: { phaseVersion: 1, confirmation: 'CLOSE' },
        });
        expect(retry.status()).toBe(201);
        const late = await contexts[0]!.request.post(`/api/sessions/${session.id}/rating`, {
            data: { score: 10 },
        });
        expect(late.status()).toBe(409);
        expect(await prisma.sessionRating.findMany({ where: { sessionId: session.id } })).toEqual(
            before,
        );
        const audits = await prisma.clubAuditEvent.findMany({
            where: { sessionId: session.id, action: 'SESSION_RATING_CLOSED' },
        });
        expect(audits).toHaveLength(1);
    } finally {
        await journey.cleanup();
    }
});

test('Two open Rating Sessions coexist with one blocking screening and move independently into Hub history', async ({
    browser,
}) => {
    const journey = await createRatingJourney(browser);
    const { session, contexts, pages } = journey;
    const admin = contexts[0]!;
    const page = pages[0]!;
    try {
        const create = () =>
            admin.request.post(`/api/clubs/${session.clubId}/sessions`, {
                data: {
                    type: 'PRE_SELECTED',
                    movieId: session.movieId,
                    scheduledAt: '2026-12-02T00:00:00Z',
                    location: 'Second screening room',
                    deadlineAt: null,
                },
            });
        const secondResponse = await create();
        expect(secondResponse.status()).toBe(201);
        const second = (await secondResponse.json()) as { id: string; phaseVersion: number };
        expect(
            (
                await admin.request.post(`/api/sessions/${second.id}/rating/open`, {
                    data: { confirmation: 'OPEN', phaseVersion: second.phaseVersion },
                })
            ).status(),
        ).toBe(201);
        const blockingResponse = await create();
        expect(blockingResponse.status()).toBe(201);
        const blocking = (await blockingResponse.json()) as { id: string };
        expect((await create()).status()).toBe(409);
        await page.goto(`/clubs/${session.clubId}/sessions`);
        const ratings = page.getByRole('region', { name: 'Active Ratings' });
        await expect(ratings.getByRole('link')).toHaveCount(2);
        await expect(ratings.getByRole('progressbar', { name: '0 of 3 rated' })).toBeVisible();
        await expect(page.getByRole('link', { name: /^Open Session:/u })).toHaveAttribute(
            'href',
            `/sessions/${blocking.id}`,
        );
        expect(
            (
                await admin.request.post(`/api/sessions/${session.id}/rating/close`, {
                    data: { confirmation: 'CLOSE', phaseVersion: 1 },
                })
            ).status(),
        ).toBe(201);
        await page.reload();
        await expect(ratings.getByRole('link')).toHaveCount(1);
        const history = page.getByRole('region', { name: 'History', exact: true });
        await expect(history.getByRole('link')).toHaveAttribute('href', `/sessions/${session.id}`);
        await history.getByRole('link').click();
        await expect(page.getByText('completed', { exact: true })).toBeVisible();
        await expect(page.getByText('No ratings were received.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
    } finally {
        await journey.cleanup();
    }
});
