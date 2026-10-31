import { randomUUID } from 'node:crypto';

import { type BrowserContext, expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { snapshotSessionSettings } from '../../packages/database/src/index.ts';
import { openVisitor } from './visitors';

test('Only Club operators open Rating and both clients see the manual transition', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const { prisma } = backend;
    const users: string[] = [];
    const contexts: BrowserContext[] = [];
    const clubId = randomUUID();
    const movieId = randomUUID();
    try {
        await prisma.club.create({ data: { id: clubId, name: 'Watching Journey' } });
        await prisma.movie.create({ data: { id: movieId, title: 'Journey screening' } });
        for (const role of ['ADMIN', 'MODERATOR', 'MEMBER'] as const) {
            const userId = await backend.createUser(`Watching ${role}`);
            users.push(userId);
            await prisma.membership.create({ data: { id: randomUUID(), clubId, userId, role } });
            contexts.push(await openVisitor(browser, backend, userId));
        }
        const session = await prisma.session.create({
            data: {
                id: randomUUID(),
                clubId,
                type: 'PRE_SELECTED',
                phase: 'WATCHING',
                movieId,
                topic: 'Watching journey',
                location: 'Screening room',
                scheduledAt: new Date('2026-12-01T20:00:00Z'),
                ...(await snapshotSessionSettings(prisma, clubId)),
            },
        });
        const adminPage = await contexts[0]!.newPage();
        const operatorPage = await contexts[1]!.newPage();
        const memberPage = await contexts[2]!.newPage();
        for (const page of [adminPage, operatorPage, memberPage]) {
            await page.goto(`/sessions/${session.id}`);
            await expect(page.getByText('watching', { exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Join Session', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Leave Session' })).toBeVisible();
        }
        await expect(memberPage.getByRole('button', { name: 'Session settings' })).toHaveCount(0);
        const denied = await contexts[2]!.request.post(`/api/sessions/${session.id}/rating/open`, {
            data: { confirmation: 'OPEN', phaseVersion: 1 },
        });
        expect(denied.status()).toBe(403);
        await adminPage.getByRole('button', { name: 'Session settings' }).click();
        await expect(adminPage.getByRole('menuitem', { name: 'Open Rating' })).toBeVisible();
        await adminPage.keyboard.press('Escape');
        await adminPage.goto(`/clubs/${clubId}/settings`);
        await adminPage.getByRole('button', { name: 'Start next phase: Rating' }).click();
        await expect(adminPage.getByRole('dialog', { name: 'Open Rating' })).toBeVisible();
        await adminPage.getByRole('button', { name: 'Keep Watching' }).click();
        await adminPage.goto(`/sessions/${session.id}`);
        await expect(memberPage.getByText('3 members have joined the screening.')).toBeVisible({
            timeout: 20000,
        });
        expect(await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject(
            { phase: 'WATCHING', phaseVersion: 1 },
        );
        await operatorPage.getByRole('button', { name: 'Session settings' }).click();
        await operatorPage.getByRole('menuitem', { name: 'Open Rating' }).click();
        const dialog = operatorPage.getByRole('dialog', { name: 'Open Rating' });
        await dialog.getByLabel('Type OPEN to confirm').fill('OPEN');
        await dialog.getByRole('button', { name: 'Open Rating', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        for (const page of [adminPage, operatorPage, memberPage]) {
            await expect(page.getByText('rating', { exact: true })).toBeVisible({ timeout: 20000 });
        }
        const retry = await contexts[0]!.request.post(`/api/sessions/${session.id}/rating/open`, {
            data: { confirmation: 'OPEN', phaseVersion: 1 },
        });
        expect(retry.status()).toBe(201);
        const auditEvents = await prisma.clubAuditEvent.findMany({
            where: { sessionId: session.id, action: 'SESSION_RATING_OPENED' },
        });
        expect(auditEvents).toHaveLength(1);
        const create = await contexts[0]!.request.post(`/api/clubs/${clubId}/sessions`, {
            data: {
                type: 'FULL_CYCLE',
                movieId: null,
                location: 'Next screening room',
                scheduledAt: '2090-12-02T20:00:00Z',
                deadlineAt: null,
            },
        });
        expect(create.status()).toBe(201);
        await adminPage.goto(`/clubs/${clubId}/settings`);
        await expect(
            adminPage.getByRole('button', { name: 'Start next phase: Rating' }),
        ).toHaveCount(0);
    } finally {
        for (const context of contexts) await context.close();
        await backend.removeUsers(users);
        await backend.removeMovies([movieId]);
        await backend.close();
    }
});
