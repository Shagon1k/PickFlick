import { randomUUID } from 'node:crypto';

import type { IPendingSessionInvitation, ISessionRoster } from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import {
    addMember,
    createSession,
    createUser,
    findNotifiedUsers,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import { readRoster } from '../session-roster-projection.js';

describe('Session roster', () => {
    let api: ITestApi;
    let users: string[];
    let admin: string;
    let moderator: string;
    let member: string;
    let outsider: string;
    let clubId: string;
    let sessionId: string;
    let memberId: string;
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 4 }, () => createUser(api.prisma)));
        [admin, moderator, member, outsider] = users as [string, string, string, string];
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Private Club' } });
        for (const [userId, role] of [
            [admin, 'ADMIN'],
            [moderator, 'MODERATOR'],
            [member, 'MEMBER'],
        ] as const) {
            const membership = await addMember(api.prisma, clubId, userId, role);
            if (userId === member) memberId = membership;
        }
        const session = await createSession(api.prisma, clubId, {
            type: 'FULL_CYCLE',
            phase: 'NOMINATION',
            topic: 'Protected title',
            location: 'Secret room',
        });
        sessionId = session.id;
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
    });
    afterAll(async () => {
        await api.close();
    });
    const participate = (decision: 'accept' | 'decline' = 'accept', userId = member) =>
        api.request(`/sessions/${sessionId}/participation`, {
            userId,
            method: 'POST',
            json: { decision },
        });
    const roster = async (userId = admin) =>
        (await (
            await api.request(`/sessions/${sessionId}/roster`, { userId })
        ).json()) as ISessionRoster;
    const accepted = () =>
        api.prisma.sessionParticipant.count({ where: { sessionId, status: 'ACCEPTED' } });
    const pending = async (userId = member) =>
        (await (
            await api.request('/session-invitations/pending', { userId })
        ).json()) as IPendingSessionInvitation[];
    const leave = (userId = member) =>
        api.request(`/sessions/${sessionId}/leave`, {
            userId,
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
    const remove = (id: string, userId = moderator) =>
        api.request(`/sessions/${sessionId}/participants/${id}/remove`, {
            userId,
            method: 'POST',
            json: { confirmation: 'REMOVE' },
        });

    it('should list open Sessions for Club members until they answer', async () => {
        expect(await pending()).toEqual([
            expect.objectContaining({ id: sessionId, topic: 'Protected title', scheduledAt: null }),
        ]);
        expect((await participate('accept', outsider)).status).toBe(404);
        expect(await (await participate('decline')).json()).toEqual({ state: 'declined' });
        expect(await pending()).toEqual([]);
        expect(await accepted()).toBe(0);
    });
    it('should require operator rights and typed confirmations', async () => {
        await participate();
        const participant = (await roster()).participants[0]!;
        expect((await remove(participant.id, member)).status).toBe(403);
        expect((await remove(participant.id, outsider)).status).toBe(404);
        await api.expectStatus(400, `/sessions/${sessionId}/leave`, {
            userId: member,
            method: 'POST',
            json: { confirmation: 'wrong' },
        });
        await api.expectStatus(
            400,
            `/sessions/${sessionId}/participants/${participant.id}/remove`,
            {
                userId: admin,
                method: 'POST',
                json: {},
            },
        );
        expect(await accepted()).toBe(1);
    });
    it('should leave or remove once and keep a removed participant out', async () => {
        await participate();
        expect((await leave()).status).toBe(204);
        expect((await leave()).status).toBe(204);
        expect(await accepted()).toBe(0);
        await participate();
        const participant = (await roster()).participants[0]!;
        expect((await remove(participant.id)).status).toBe(204);
        expect((await remove(participant.id)).status).toBe(204);
        expect(await accepted()).toBe(0);
        expect(
            await findNotifiedUsers(api.prisma, participant.id, 'SESSION_PARTICIPANT_REMOVED'),
        ).toEqual([member]);
        expect((await participate()).status).toBe(409);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_PARTICIPANT_REMOVED' },
            }),
        ).toBe(1);
    });

    it('should let Moderators remove only Members, and nobody the Admin', async () => {
        const join = (userId: string) =>
            api.request(`/sessions/${sessionId}/participation`, {
                userId,
                method: 'POST',
                json: { decision: 'accept' },
            });
        for (const userId of [admin, moderator, member])
            expect((await join(userId)).status).toBe(200);
        const idOf = async (userId: string) =>
            (
                await api.prisma.sessionParticipant.findFirstOrThrow({
                    where: { sessionId, membership: { userId } },
                })
            ).id;
        const removable = (await roster(moderator)).participants
            .filter((participant) => participant.canRemove)
            .map((participant) => participant.id);
        expect(removable).toEqual([await idOf(member)]);
        expect((await remove(await idOf(admin))).status).toBe(403);
        expect((await remove(await idOf(moderator), admin)).status).toBe(204);
        expect((await remove(await idOf(member))).status).toBe(204);
    });

    it('should return the progress version from the roster snapshot across a departure', async () => {
        await participate();
        await api.prisma.$transaction(
            async (tx) => {
                const before = await readRoster(tx, admin, sessionId);
                expect(before.acceptedCount).toBe(1);
                expect((await leave()).status).toBe(204);
                const detail = await api.prisma.session.findUniqueOrThrow({
                    where: { id: sessionId },
                });
                const sameSnapshot = await readRoster(tx, admin, sessionId);
                expect(sameSnapshot).toMatchObject({
                    acceptedCount: 1,
                    progressVersion: before.progressVersion,
                });
                expect(detail.progressVersion).toBeGreaterThan(before.progressVersion);
                expect(await roster()).toMatchObject({
                    acceptedCount: 0,
                    progressVersion: detail.progressVersion,
                });
            },
            { isolationLevel: 'RepeatableRead' },
        );
    });
    it('should propagate Club departure to open Sessions and preserve completed history', async () => {
        await participate();
        const settings = await snapshotSessionSettings(api.prisma, clubId);
        const completed = await api.prisma.session.create({
            data: { id: randomUUID(), clubId, type: 'PAST', phase: 'COMPLETED', ...settings },
        });
        await api.prisma.sessionParticipant.create({
            data: {
                clubId,
                sessionId: completed.id,
                membershipId: memberId,
                status: 'ACCEPTED',
                attended: true,
            },
        });
        await Promise.all([
            api.request(`/clubs/${clubId}/leave`, {
                userId: member,
                method: 'POST',
                json: { confirmation: 'LEAVE' },
            }),
            participate(),
        ]);
        expect(await accepted()).toBe(0);
        expect(
            await api.prisma.sessionParticipant.findFirst({ where: { sessionId: completed.id } }),
        ).toMatchObject({ status: 'ACCEPTED', attended: true });
        expect(await roster()).toMatchObject({ acceptedCount: 0 });
    });
    it('should propagate Club removal and prevent later acceptance', async () => {
        await participate('decline');
        const response = await api.request(`/clubs/${clubId}/members/${memberId}/remove`, {
            userId: admin,
            method: 'POST',
            json: { confirmation: 'REMOVE' },
        });
        expect(response.status).toBe(204);
        expect(await pending()).toEqual([]);
        expect((await participate()).status).toBe(404);
        const participant = (await roster()).participants[0]!;
        expect(participant.status).toBe('DECLINED');
        // Club removal is announced once, as MEMBERSHIP_REMOVED.
        expect(
            await findNotifiedUsers(api.prisma, participant.id, 'SESSION_PARTICIPANT_REMOVED'),
        ).toEqual([]);
    });
    it('should freeze roster management in restricted Clubs while keeping existing participation', async () => {
        await api.prisma.membership.updateMany({
            where: { clubId, userId: admin },
            data: { role: 'MEMBER' },
        });
        expect(await (await participate()).json()).toMatchObject({ state: 'accepted' });
        const participant = (await roster(moderator)).participants[0]!;
        expect((await remove(participant.id)).status).toBe(409);
        expect((await roster(moderator)).canManage).toBe(false);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await roster(moderator)).canManage).toBe(false);
    });
    it('should hide Sessions of archived Clubs and disallow terminal roster changes', async () => {
        await participate();
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect(await pending()).toEqual([]);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await api.request(`/sessions/${sessionId}/cancel`, {
            userId: admin,
            method: 'POST',
            json: { version: 1, confirmation: 'CANCEL' },
        });
        expect((await participate()).status).toBe(409);
        expect((await leave()).status).toBe(409);
        expect((await roster()).canManage).toBe(false);
    });
});
