import { randomUUID } from 'node:crypto';

import type { IClubHub } from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';

describe('Club Hub projection', () => {
    let api: ITestApi;
    let admin: string;
    let member: string;
    let first: string;
    let second: string;
    let secondMembership: string;

    beforeAll(async () => {
        api = await startTestApi();
        [admin, member] = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        first = randomUUID();
        second = randomUUID();
        secondMembership = randomUUID();
        for (const [id, name, owner] of [
            [first, 'First Club', admin],
            [second, 'Second Club', member],
        ] as const) {
            await api.prisma.club.create({ data: { id, name } });
            await addMember(api.prisma, id, owner, 'ADMIN');
        }
        await api.prisma.membership.create({
            data: { id: secondMembership, clubId: second, userId: admin, role: 'MEMBER' },
        });
        await createSession(api.prisma, first, {
            type: 'FULL_CYCLE',
            phase: 'NOMINATION',
            topic: 'First Club private Session',
        });
        await createSession(api.prisma, second, {
            type: 'PAST',
            phase: 'COMPLETED',
            topic: 'Second Club private Session',
        });
    });

    afterAll(async () => {
        await removeUsers(api.prisma, [admin, member]);
        await api.close();
    });

    it('should return one Club context with its own counts and recent activity', async () => {
        const firstResponse = await api.request(`/clubs/${first}/hub`, { userId: admin });
        const secondResponse = await api.request(`/clubs/${second}/hub`, { userId: admin });
        const firstHub = (await firstResponse.json()) as IClubHub;
        const secondHub = (await secondResponse.json()) as IClubHub;

        expect(firstResponse.headers.get('cache-control')).toBe('private, no-store');
        expect(firstHub).toMatchObject({
            club: { id: first, name: 'First Club' },
            memberCount: 1,
            sessionCount: 1,
            completedSessionCount: 0,
            activeSession: { topic: 'First Club private Session' },
        });
        expect(secondHub).toMatchObject({
            club: { id: second, name: 'Second Club' },
            memberCount: 2,
            sessionCount: 1,
            completedSessionCount: 1,
            recentSessions: [{ topic: 'Second Club private Session' }],
        });
        expect(JSON.stringify(secondHub)).not.toContain('First Club private Session');
    });

    it('should retain open Rating Sessions beyond recent activity and prefer a blocking Session', async () => {
        const ratingId = randomUUID();
        const settings = await snapshotSessionSettings(api.prisma, second);
        await api.prisma.session.createMany({
            data: [
                {
                    ...(await snapshotSessionSettings(api.prisma, first)),
                    id: randomUUID(),
                    clubId: first,
                    type: 'FULL_CYCLE',
                    phase: 'RATING',
                },
                {
                    id: randomUUID(),
                    clubId: second,
                    ...settings,
                    type: 'FULL_CYCLE',
                    phase: 'RATING',
                    updatedAt: new Date('2026-01-01T00:00:00Z'),
                },
                {
                    id: ratingId,
                    clubId: second,
                    ...settings,
                    type: 'FULL_CYCLE',
                    phase: 'RATING',
                    updatedAt: new Date('2026-01-02T00:00:00Z'),
                },
                ...Array.from({ length: 5 }, () => ({
                    id: randomUUID(),
                    clubId: second,
                    ...settings,
                    type: 'PAST' as const,
                    phase: 'COMPLETED' as const,
                    updatedAt: new Date('2026-02-01T00:00:00Z'),
                })),
            ],
        });

        const firstHub = (await (
            await api.request(`/clubs/${first}/hub`, { userId: admin })
        ).json()) as IClubHub;
        const secondHub = (await (
            await api.request(`/clubs/${second}/hub`, { userId: admin })
        ).json()) as IClubHub;

        expect(firstHub.activeSession?.phase).toBe('NOMINATION');
        expect(secondHub.activeSession).toMatchObject({ id: ratingId, phase: 'RATING' });
        expect(secondHub.recentSessions).toHaveLength(5);
        expect(secondHub.recentSessions.every(({ phase }) => phase === 'COMPLETED')).toBe(true);
    });

    it('should hide a stale Hub after Membership removal', async () => {
        await api.prisma.membership.update({
            where: { id: secondMembership },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const response = await api.request(`/clubs/${second}/hub`, { userId: admin });

        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain('Second Club');
    });
});
