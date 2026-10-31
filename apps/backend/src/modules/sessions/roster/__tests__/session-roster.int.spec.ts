import { randomUUID } from 'node:crypto';

import type {
    ICreatedInvitation,
    IPendingSessionInvitation,
    ISessionRoster,
} from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import { readRoster } from '../session-roster-projection.js';

const unavailable = { state: 'unavailable' };
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
    const invite = (userId = admin, membershipId = memberId) =>
        api.request(`/sessions/${sessionId}/invitations`, {
            userId,
            method: 'POST',
            json: { membershipId },
        });
    const preview = (token: string, userId = member) =>
        api.request('/session-invitations/preview', { userId, method: 'POST', json: { token } });
    const respond = (token: string, decision = 'accept', userId = member) =>
        api.request('/session-invitations/respond', {
            userId,
            method: 'POST',
            json: { token, decision },
        });
    const roster = async (userId = admin) =>
        (await (
            await api.request(`/sessions/${sessionId}/roster`, { userId })
        ).json()) as ISessionRoster;
    const createInvite = async () => (await (await invite()).json()) as ICreatedInvitation;
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
    const revoke = (id: string, userId = moderator) =>
        api.request(`/sessions/${sessionId}/invitations/${id}/revoke`, { userId, method: 'POST' });

    it('should accept once without creating Membership and count one accepted participant', async () => {
        const invitation = await createInvite();
        expect(invitation.token).toHaveLength(43);
        expect(await (await preview(invitation.token)).json()).toMatchObject({
            state: 'valid',
            topic: 'Protected title',
        });
        const membershipCount = await api.prisma.membership.count();
        const responses = await Promise.all([respond(invitation.token), respond(invitation.token)]);
        expect(await responses[0]?.json()).toMatchObject({ state: 'accepted', sessionId });
        expect(await responses[1]?.json()).toMatchObject({ state: 'accepted', sessionId });
        expect(await api.prisma.membership.count()).toBe(membershipCount);
        expect(await accepted()).toBe(1);
        expect(await roster()).toMatchObject({ acceptedCount: 1 });
        expect(await pending()).toEqual([]);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_INVITE_RESPONDED' },
            }),
        ).toBe(1);
        const stored = await api.prisma.sessionInvite.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(stored.tokenDigest).toHaveLength(64);
        expect(JSON.stringify(stored)).not.toContain(invitation.token);
    });
    it('should deny non-members, wrong recipients, invalid links and departed memberships without details', async () => {
        const invitation = await createInvite();
        for (const userId of [outsider, admin, moderator]) {
            expect(await (await preview(invitation.token, userId)).json()).toEqual(unavailable);
            expect(await (await respond(invitation.token, 'accept', userId)).json()).toEqual(
                unavailable,
            );
            expect((await pending(userId)).map((row) => row.id)).toEqual(
                userId === outsider ? [] : [sessionId],
            );
        }
        expect(await (await preview('a'.repeat(43))).json()).toEqual(unavailable);
        expect((await preview(invitation.token)).headers.get('Cache-Control')).toBe(
            'private, no-store',
        );
        expect(
            (
                await api.request('/session-invitations/preview', {
                    method: 'POST',
                    json: { token: invitation.token },
                })
            ).status,
        ).toBe(401);
        await api.expectStatus(404, `/sessions/${sessionId}/roster`, { userId: outsider });
        await api.request(`/clubs/${clubId}/leave`, {
            userId: member,
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
        await addMember(api.prisma, clubId, member);
        expect(await (await preview(invitation.token)).json()).toEqual(unavailable);
        expect(await (await respond(invitation.token)).json()).toEqual(unavailable);
        expect(await accepted()).toBe(0);
    });
    it('should list open Sessions for Club members without token material', async () => {
        const invitation = await createInvite();
        const rows = await pending();
        expect(rows).toEqual([
            expect.objectContaining({ id: sessionId, topic: 'Protected title', scheduledAt: null }),
        ]);
        expect(JSON.stringify(rows)).not.toContain(invitation.token);
        expect(JSON.stringify(rows)).not.toContain('tokenDigest');
        expect(
            await (
                await api.request(`/session-invitations/${invitation.id}/respond`, {
                    userId: outsider,
                    method: 'POST',
                    json: { decision: 'accept' },
                })
            ).json(),
        ).toEqual(unavailable);
        expect(
            await (
                await api.request(`/session-invitations/${invitation.id}/respond`, {
                    userId: member,
                    method: 'POST',
                    json: { decision: 'decline' },
                })
            ).json(),
        ).toEqual({ state: 'declined' });
        expect(await pending()).toEqual([]);
        expect(await accepted()).toBe(0);
        expect(await (await respond(invitation.token)).json()).toEqual({ state: 'declined' });
    });
    it('should invalidate expired, revoked and replaced links', async () => {
        const first = await createInvite();
        const second = await createInvite();
        expect(await (await preview(first.token)).json()).toEqual(unavailable);
        expect((await pending()).map((row) => row.id)).toEqual([sessionId]);
        await api.prisma.sessionInvite.update({
            where: { id: second.id },
            data: {
                createdAt: new Date(Date.now() - 2000),
                expiresAt: new Date(Date.now() - 1000),
            },
        });
        expect(await (await respond(second.token)).json()).toEqual(unavailable);
        expect((await pending()).map((row) => row.id)).toEqual([sessionId]);
        const third = await createInvite();
        expect((await revoke(third.id)).status).toBe(204);
        expect((await revoke(third.id)).status).toBe(204);
        expect(await (await preview(third.token)).json()).toEqual(unavailable);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_INVITE_REVOKED' },
            }),
        ).toBe(1);
    });
    it('should require operator rights, active same-Club targets and typed confirmations', async () => {
        expect((await invite(member)).status).toBe(403);
        expect((await invite(outsider)).status).toBe(404);
        expect((await invite(admin, randomUUID())).status).toBe(409);
        const other = await api.prisma.club.create({
            data: { id: randomUUID(), name: 'Other Club' },
        });
        const foreign = await addMember(api.prisma, other.id, member);
        expect((await invite(admin, foreign)).status).toBe(409);
        const invitation = await createInvite();
        await respond(invitation.token);
        const participant = (await roster()).participants[0]!;
        expect((await remove(participant.id, member)).status).toBe(403);
        expect((await revoke(invitation.id, member)).status).toBe(403);
        expect((await remove(participant.id, outsider)).status).toBe(404);
        expect(
            (
                await api.request(`/sessions/${sessionId}/leave`, {
                    userId: member,
                    method: 'POST',
                    json: { confirmation: 'wrong' },
                })
            ).status,
        ).toBe(400);
        expect(
            (
                await api.request(`/sessions/${sessionId}/participants/${participant.id}/remove`, {
                    userId: admin,
                    method: 'POST',
                    json: {},
                })
            ).status,
        ).toBe(400);
        expect(await accepted()).toBe(1);
    });
    it('should leave or remove once and prevent old accepted links from restoring participation', async () => {
        const invitation = await createInvite();
        await respond(invitation.token);
        expect((await leave()).status).toBe(204);
        expect((await leave()).status).toBe(204);
        expect(await accepted()).toBe(0);
        expect(await (await respond(invitation.token)).json()).toEqual(unavailable);
        const replacement = await createInvite();
        await respond(replacement.token);
        const participant = (await roster()).participants[0]!;
        expect((await remove(participant.id)).status).toBe(204);
        expect((await remove(participant.id)).status).toBe(204);
        expect(await accepted()).toBe(0);
        expect(await (await respond(replacement.token)).json()).toEqual(unavailable);
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
        const invitation = await createInvite();
        await respond(invitation.token);
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
    it('should serialize acceptance with removal and revocation', async () => {
        const invitation = await createInvite();
        const participant = (await roster()).participants[0]!;
        await Promise.all([respond(invitation.token), remove(participant.id)]);
        expect(await accepted()).toBe(0);
        expect(await (await preview(invitation.token)).json()).toEqual(unavailable);
        const replacement = await createInvite();
        await Promise.all([respond(replacement.token), revoke(replacement.id)]);
        const stored = await api.prisma.sessionInvite.findUniqueOrThrow({
            where: { id: replacement.id },
        });
        expect(Boolean(stored.respondedAt)).not.toBe(Boolean(stored.revokedAt));
        expect(await accepted()).toBe(stored.accepted ? 1 : 0);
    });
    it('should propagate Club departure to open Sessions, preserve completed history, and revoke links', async () => {
        const invitation = await createInvite();
        await respond(invitation.token);
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
            respond(invitation.token),
        ]);
        expect(await accepted()).toBe(0);
        expect(
            await api.prisma.sessionParticipant.findFirst({ where: { sessionId: completed.id } }),
        ).toMatchObject({ status: 'ACCEPTED', attended: true });
        expect(await (await preview(invitation.token)).json()).toEqual(unavailable);
        expect(await roster()).toMatchObject({ acceptedCount: 0 });
    });
    it('should propagate Club removal for pending participants and prevent later acceptance', async () => {
        const invitation = await createInvite();
        const response = await api.request(`/clubs/${clubId}/members/${memberId}/remove`, {
            userId: admin,
            method: 'POST',
            json: { confirmation: 'REMOVE' },
        });
        expect(response.status).toBe(204);
        expect(await pending()).toEqual([]);
        expect(await (await respond(invitation.token)).json()).toEqual(unavailable);
        expect((await roster()).participants[0]?.status).toBe('REMOVED');
    });
    it('should freeze roster management in restricted Clubs while keeping existing participation', async () => {
        const invitation = await createInvite();
        await api.prisma.membership.updateMany({
            where: { clubId, userId: admin },
            data: { role: 'MEMBER' },
        });
        expect((await invite(moderator)).status).toBe(409);
        expect(await (await respond(invitation.token)).json()).toMatchObject({ state: 'accepted' });
        expect((await roster(moderator)).canInvite).toBe(false);
        const participant = (await roster(moderator)).participants[0]!;
        expect((await remove(participant.id)).status).toBe(409);
        expect((await roster(moderator)).canManage).toBe(false);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await invite(moderator)).status).toBe(409);
        expect((await roster(moderator)).canManage).toBe(false);
    });
    it('should hide cancelled and archived invitations and disallow terminal roster changes', async () => {
        const invitation = await createInvite();
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect(await (await preview(invitation.token)).json()).toEqual(unavailable);
        expect(await pending()).toEqual([]);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await api.request(`/sessions/${sessionId}/cancel`, {
            userId: admin,
            method: 'POST',
            json: { version: 1, confirmation: 'CANCEL' },
        });
        expect(await (await respond(invitation.token)).json()).toEqual(unavailable);
        expect((await invite()).status).toBe(409);
        expect((await leave()).status).toBe(409);
        expect((await roster()).canInvite).toBe(false);
    });
});
