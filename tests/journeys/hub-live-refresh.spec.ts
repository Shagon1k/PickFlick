import { randomUUID } from 'node:crypto';

import type { TCreateSession } from '@pickflick/contracts';
import { expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { openVisitor } from './visitors';

test('A Club member with an empty inbox sees another member schedule a Session without reloading', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const users = await Promise.all([
        backend.createUser('Live Hub Admin'),
        backend.createUser('Live Hub Member'),
    ]);
    const clubId = randomUUID();
    await backend.prisma.club.create({ data: { id: clubId, name: 'Live Hub review' } });
    for (const [index, userId] of users.entries()) {
        await backend.prisma.membership.create({
            data: { id: randomUUID(), clubId, userId, role: index === 0 ? 'ADMIN' : 'MEMBER' },
        });
    }
    const admin = await openVisitor(browser, backend, users[0]);
    const member = await openVisitor(browser, backend, users[1]);
    const page = await member.newPage();
    let documentRequests = 0;
    page.on('request', (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame())
            documentRequests++;
    });
    try {
        await page.goto(`/clubs/${clubId}/sessions`);
        await expect(page.getByText('No screening scheduled', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Notifications', exact: true }).click();
        await expect(
            page
                .getByRole('dialog', { name: 'Notifications', exact: true })
                .getByText('No notifications yet.', { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        const response = await admin.request.post(`/api/clubs/${clubId}/sessions`, {
            data: {
                type: 'FULL_CYCLE',
                movieId: null,
                scheduledAt: '2090-12-01T20:00:00Z',
                location: 'Room A',
                topic: 'A new screening from another member',
                deadlineAt: null,
            } satisfies TCreateSession,
        });
        expect(response.status()).toBe(201);
        await expect(
            page.getByRole('link', {
                name: 'Open Session: A new screening from another member',
                exact: true,
            }),
        ).toBeVisible({ timeout: 20000 });
        expect(documentRequests).toBe(1);
    } finally {
        await admin.close();
        await member.close();
        await backend.removeUsers(users);
        await backend.close();
    }
});
