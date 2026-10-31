import { randomUUID } from 'node:crypto';

import { notificationListSchema } from '@pickflick/contracts';
import { createClient } from 'redis';

import {
    createUser,
    type ITestApi,
    loadIntegrationEnvironment,
    startTestApi,
} from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';
import { recordNotification } from '../notification-store.js';

async function openStream(api: ITestApi, recipient: string) {
    const abort = new AbortController();
    const response = await api.request('/notifications/stream', {
        userId: recipient,
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
    });
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    const nextRefresh = async () => {
        let content = '';
        while (!content.includes('data: {"refresh":true}')) {
            const chunk = await reader.read();
            if (chunk.done) throw new Error('Notification stream ended before refresh.');
            content += chunk.value;
        }
        return content;
    };
    await nextRefresh();
    return { nextRefresh, close: () => abort.abort() };
}

describe('NotificationSignals', () => {
    let first: ITestApi;
    let second: ITestApi;
    let users: string[];
    let admin: ReturnType<typeof createClient>;

    beforeAll(async () => {
        const environment = loadIntegrationEnvironment();
        const url = new URL(environment.redisUrl);
        if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
            throw new Error('Notification broker tests require an isolated loopback Redis.');
        }
        admin = createClient({ url: environment.redisUrl });
        await admin.connect();
        first = await startTestApi();
        second = await startTestApi();
        users = await Promise.all([createUser(first.prisma), createUser(first.prisma)]);
        // Confirm the second instance's subscription before testing delivery, without timing sleeps.
        await expectDelivery();
    });

    async function expectDelivery() {
        const received = vi.fn();
        const listener = second.signals.forRecipient(users[0]!).subscribe(received);
        try {
            await vi.waitFor(async () => {
                await first.signals.publish([users[0]!]);
                expect(received).toHaveBeenCalled();
            });
        } finally {
            listener.unsubscribe();
        }
    }

    afterAll(async () => {
        await removeUsers(first.prisma, users);
        await Promise.all([first.close(), second.close()]);
        admin.destroy();
    });

    const record = (recipientId = users[0]!, sourceId = randomUUID()) =>
        first.transactions.write((tx) =>
            recordNotification(tx, { recipientId, sourceId, event: 'BILLING_SERVICE' }),
        );

    it('should deliver committed invalidation across instances to every recipient connection and synchronize reads', async () => {
        const tabs = await Promise.all([
            openStream(second, users[0]!),
            openStream(second, users[0]!),
        ]);
        const foreign = vi.fn();
        const listener = second.signals.forRecipient(users[1]!).subscribe(foreign);
        try {
            const updates = tabs.map((tab) => tab.nextRefresh());
            const row = (await record())!;
            for (const content of await Promise.all(updates)) {
                expect(content).not.toContain(users[0]);
                expect(content).not.toContain(row.id);
            }
            expect(foreign).not.toHaveBeenCalled();
            const readUpdates = tabs.map((tab) => tab.nextRefresh());
            expect(
                (
                    await first.request(`/notifications/${row.id}/read`, {
                        userId: users[0],
                        method: 'POST',
                        json: {},
                    })
                ).status,
            ).toBe(204);
            await Promise.all(readUpdates);
            const state = await second.request('/notifications', { userId: users[0] });
            expect(await state.json()).toMatchObject({ unreadCount: 0 });
            const createdUpdates = tabs.map((tab) => tab.nextRefresh());
            await record();
            await Promise.all(createdUpdates);
            const allReadUpdates = tabs.map((tab) => tab.nextRefresh());
            expect(
                (
                    await first.request('/notifications/read', {
                        userId: users[0],
                        method: 'POST',
                        json: {},
                    })
                ).status,
            ).toBe(204);
            await Promise.all(allReadUpdates);
            const afterAllRead = await second.request('/notifications', { userId: users[0] });
            expect(await afterAllRead.json()).toMatchObject({ unreadCount: 0 });
            expect(foreign).not.toHaveBeenCalled();
        } finally {
            listener.unsubscribe();
            for (const tab of tabs) tab.close();
        }
    });

    it('should publish only after commit, deduplicate recipients and emit nothing on rollback or duplicate creation', async () => {
        const publish = vi.spyOn(first.signals, 'publish');
        const sourceId = randomUUID();
        try {
            await expect(
                first.transactions.write(async (tx) => {
                    await recordNotification(tx, {
                        recipientId: users[0]!,
                        sourceId,
                        event: 'BILLING_SERVICE',
                    });
                    expect(publish).not.toHaveBeenCalled();
                    throw new Error('synthetic rollback');
                }),
            ).rejects.toThrow('synthetic rollback');
            expect(publish).not.toHaveBeenCalled();
            expect(await first.prisma.notification.count({ where: { sourceId } })).toBe(0);
            publish.mockImplementation(async (recipients) => {
                expect([...recipients]).toEqual([users[0]]);
                expect(await second.prisma.notification.count({ where: { sourceId } })).toBe(2);
            });
            await first.transactions.write(async (tx) => {
                for (const occurrence of [1, 2]) {
                    await recordNotification(tx, {
                        recipientId: users[0]!,
                        sourceId,
                        occurrence,
                        event: 'BILLING_SERVICE',
                    });
                }
            });
            expect(publish).toHaveBeenCalledTimes(1);
            publish.mockRestore();
            const received = vi.fn();
            const listener = second.signals.forRecipient(users[0]!).subscribe(received);
            await record(users[0], sourceId);
            await admin.ping();
            expect(received).not.toHaveBeenCalled();
            listener.unsubscribe();
        } finally {
            publish.mockRestore();
        }
    });

    it('should bound a stalled publish without failing the committed action and restore subscriptions after disconnect', async () => {
        await admin.sendCommand(['CLIENT', 'PAUSE', '1500', 'ALL']);
        const started = Date.now();
        const row = await record();
        expect(row).toBeTruthy();
        expect(Date.now() - started).toBeLessThan(1200);
        expect(
            await first.prisma.notification.findUnique({ where: { id: row!.id } }),
        ).not.toBeNull();
        await admin.ping();
        await admin.sendCommand(['CLIENT', 'KILL', 'TYPE', 'PUBSUB']);
        const received = vi.fn();
        const listener = second.signals.forRecipient(users[0]!).subscribe(received);
        try {
            await vi.waitFor(
                async () => {
                    await first.signals.publish([users[0]!]);
                    expect(received).toHaveBeenCalledWith({ data: { refresh: true } });
                },
                { timeout: 10_000 },
            );
        } finally {
            listener.unsubscribe();
        }
        const state = await second.request('/notifications', { userId: users[0] });
        expect(notificationListSchema.parse(await state.json()).items).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: row!.id })]),
        );
    });
});
