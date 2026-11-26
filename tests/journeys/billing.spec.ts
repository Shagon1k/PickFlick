import { expect, test } from '@playwright/test';

import { connectJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';
import { openVisitor } from './visitors';

test('A user without Clubs buys and manages their own subscription through the real API and billing stub', async ({
    browser,
}) => {
    const backend = await connectJourneyBackend();
    const userId = await backend.createUser('Billing viewer');
    const peerId = await backend.createUser('Billing peer');
    const context = await openVisitor(browser, backend, userId);
    const peer = await openVisitor(browser, backend, peerId);
    try {
        const page = await context.newPage();
        await page.goto('/settings?tab=subscription&checkout=returned&plan=PRO');
        await expect(page.getByRole('heading', { name: 'Free Active' })).toBeVisible();
        await expect(page.getByText(/Payment confirmation pending/)).toBeVisible();
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Upgrade to Pro', exact: true }).click();
        await expect(page).toHaveURL(/tab=subscription&checkout=returned/);
        await expect(page.getByRole('heading', { name: 'Pro Active' })).toBeVisible();
        await expect(page.getByText(/You do not administer any active Clubs/)).toBeVisible();
        const subscription = await backend.prisma.subscription.findUniqueOrThrow({
            where: { userId },
        });
        expect(subscription.plan).toBe('PRO');
        expect(subscription.paidThrough).not.toBeNull();
        await page.getByRole('button', { name: 'Open billing portal' }).click();
        await expect(page).toHaveURL(/tab=subscription/);
        await expect(page.getByRole('heading', { name: 'Pro Active' })).toBeVisible();
        const peerPage = await peer.newPage();
        await peerPage.goto('/settings?tab=subscription&checkout=returned');
        await expect(peerPage.getByRole('heading', { name: 'Free Active' })).toBeVisible();
        await expect(peerPage.getByRole('button', { name: 'Open billing portal' })).toBeDisabled();
        const peerSubscription = await backend.prisma.subscription.findUnique({
            where: { userId: peerId },
        });
        expect(peerSubscription).toBeNull();
    } finally {
        await context.close();
        await peer.close();
        await backend.removeUsers([userId, peerId]);
        await backend.close();
    }
});
