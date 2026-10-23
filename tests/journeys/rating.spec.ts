import { randomUUID } from 'node:crypto';

import { type Browser, type BrowserContext, expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { loadRuntimeEnvironment } from '../../packages/config/src/environment.ts';
import {
    createDatabaseClient,
    snapshotSessionSettings,
} from '../../packages/database/src/index.ts';

async function createRatingJourney(browser: Browser) {
    const backend = await connectJourneyBackend();
    const prisma = createDatabaseClient(loadRuntimeEnvironment().databaseUrl);
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
        await prisma.clubAuditEvent.deleteMany({ where: { clubId } });
        await prisma.sessionRating.deleteMany({ where: { sessionId: session.id } });
        await prisma.sessionParticipant.deleteMany({ where: { clubId } });
        await prisma.session.deleteMany({ where: { clubId } });
        await prisma.membership.deleteMany({ where: { clubId } });
        await prisma.club.delete({ where: { id: clubId } });
        await prisma.movie.delete({ where: { id: movie.id } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
        await prisma.$disconnect();
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
            const context = await browser.newContext({
                extraHTTPHeaders: { 'x-forwarded-for': `2001:db8:${randomUUID().slice(0, 4)}::1` },
            });
            contexts.push(context);
            await context.addCookies(await backend.cookiesFor(userId, '127.0.0.1'));
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
