import { randomUUID } from 'node:crypto';

import { notificationListSchema } from '@pickflick/contracts';

import { createUser, type ITestApi, startTestApi } from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import { recordNotification } from '../../notification-store.js';

describe('Inbox', () => {
    let api: ITestApi;
    let users: string[];

    beforeAll(async () => {
        api = await startTestApi();
        users = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.close();
    });
    const create = (recipientId = users[0]!) =>
        api.prisma.$transaction((tx) =>
            recordNotification(tx, {
                recipientId,
                event: 'BILLING_SERVICE',
                sourceId: randomUUID(),
            }),
        );
    const list = async (query = '', userId = users[0]!) => {
        const response = await api.request(`/notifications${query}`, { userId });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        return notificationListSchema.parse(await response.json());
    };

    it('should isolate recipients, reject selectors and scope cursors and read actions', async () => {
        const own = (await create())!;
        const foreign = (await create(users[1]))!;
        await api.expectStatus(401, '/notifications');
        await api.expectStatus(401, '/notifications/stream');
        for (const query of ['?userId=other', '?limit=0', '?limit=51', '?cursor=invalid']) {
            await api.expectStatus(400, `/notifications${query}`, { userId: users[0] });
        }
        await api.expectStatus(404, `/notifications?cursor=${foreign.id}`, { userId: users[0] });
        expect((await list()).items.map((item) => item.id)).toContain(own.id);
        expect((await list()).items.map((item) => item.id)).not.toContain(foreign.id);
        expect(
            (
                await api.request(`/notifications/${foreign.id}/read`, {
                    userId: users[0],
                    method: 'POST',
                    json: {},
                })
            ).status,
        ).toBe(404);
        expect(
            (
                await api.request('/notifications/read', {
                    userId: users[0],
                    method: 'POST',
                    json: { userId: users[1] },
                })
            ).status,
        ).toBe(400);
        await api.expectStatus(400, '/notifications/stream?userId=other', { userId: users[0] });
    });

    it('should stream only recipient-authorized refresh signals without proxy buffering', async () => {
        const controller = new AbortController();
        try {
            const response = await api.request('/notifications/stream', {
                userId: users[0],
                signal: controller.signal,
            });
            expect(response.status).toBe(200);
            expect(response.headers.get('cache-control')).toContain('private');
            expect(response.headers.get('cache-control')).toContain('no-store');
            expect(response.headers.get('cache-control')).toContain('no-transform');
            expect(response.headers.get('x-accel-buffering')).toBe('no');
            const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
            let content = '';
            while (!content.includes('data:')) {
                const chunk = await reader.read();
                if (chunk.done) break;
                content += chunk.value;
            }
            expect(content).toContain('data: {"refresh":true}');
            expect(content).not.toContain(users[0]);
            expect(content).not.toContain(users[1]);
        } finally {
            controller.abort();
        }
    });

    it('should paginate tied timestamps without duplicates and exclude suppressed events', async () => {
        await api.prisma.notification.deleteMany({ where: { recipientId: users[0] } });
        const rows = await Promise.all(Array.from({ length: 5 }, () => create()));
        await api.prisma.notification.updateMany({
            where: { recipientId: users[0] },
            data: { createdAt: new Date('2026-10-27T08:00:00Z') },
        });
        await api.prisma.notificationPreference.create({
            data: { userId: users[0]!, event: 'ACHIEVEMENT_EARNED', inApp: false, email: false },
        });
        const suppressed = await api.prisma.$transaction((tx) =>
            recordNotification(tx, {
                recipientId: users[0]!,
                event: 'ACHIEVEMENT_EARNED',
                sourceId: randomUUID(),
                awardId: randomUUID(),
            }),
        );
        const first = await list('?limit=2');
        const second = await list(`?limit=2&cursor=${first.nextCursor!}`);
        const third = await list(`?limit=2&cursor=${second.nextCursor!}`);
        expect(first.unreadCount).toBe(5);
        expect(third.nextCursor).toBeNull();
        expect([...first.items, ...second.items, ...third.items].map((item) => item.id)).toEqual(
            rows.map((row) => row!.id).sort((a, b) => b.localeCompare(a)),
        );
        expect(first.items.map((item) => item.id)).not.toContain(suppressed!.id);
        expect(
            (
                await api.request(`/notifications/${suppressed!.id}/read`, {
                    userId: users[0],
                    method: 'POST',
                    json: {},
                })
            ).status,
        ).toBe(404);
    });

    it('should preserve the first read timestamp across concurrent reads and synchronize all-read state', async () => {
        const row = (await create())!;
        const read = () =>
            api.request(`/notifications/${row.id}/read`, {
                userId: users[0],
                method: 'POST',
                json: {},
            });
        expect((await Promise.all([read(), read()])).map((response) => response.status)).toEqual([
            204, 204,
        ]);
        const first = await api.prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
        await read();
        expect(
            (await api.prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).readAt,
        ).toEqual(first.readAt);
        expect(
            (
                await api.request('/notifications/read', {
                    userId: users[0],
                    method: 'POST',
                    json: {},
                })
            ).status,
        ).toBe(204);
        expect((await list()).unreadCount).toBe(0);
        expect((await list('', users[1])).unreadCount).toBeGreaterThan(0);
        const fresh = (await create())!;
        expect((await list()).items.find((item) => item.id === fresh.id)?.readAt).toBeNull();
        expect((await list()).unreadCount).toBe(1);
    });

    it('should return generic copy for a missing entity and no content for inactive recipients', async () => {
        const clubId = randomUUID();
        const row = await api.prisma.$transaction((tx) =>
            recordNotification(tx, {
                recipientId: users[0]!,
                event: 'CLUB_ARCHIVED',
                sourceId: randomUUID(),
                clubId,
            }),
        );
        const projected = (await list()).items.find((item) => item.id === row!.id);
        expect(projected).toMatchObject({
            message: 'This update is no longer available.',
            href: null,
        });
        expect(JSON.stringify(projected)).not.toContain(clubId);
        await api.prisma.user.update({ where: { id: users[0] }, data: { status: 'SUSPENDED' } });
        expect(await list()).toMatchObject({ items: [], unreadCount: 0 });
    });
});
