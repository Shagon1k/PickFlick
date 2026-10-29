import { randomUUID } from 'node:crypto';

import type { IClubSettings } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';

describe('Club membership boundaries', () => {
    let api: ITestApi;
    let users: string[];
    let clubId: string;
    let admin: string;
    let moderator: string;
    let member: string;
    let outsider: string;
    let memberId: string;
    let moderatorId: string;
    beforeAll(async () => {
        api = await startTestApi();
    });
    afterAll(async () => {
        await api.close();
    });
    beforeEach(async () => {
        admin = await createUser(api.prisma);
        moderator = await createUser(api.prisma);
        member = await createUser(api.prisma);
        outsider = await createUser(api.prisma);
        users = [admin, moderator, member, outsider];
        clubId = randomUUID();
        memberId = randomUUID();
        moderatorId = randomUUID();
        await api.prisma.club.create({
            data: {
                id: clubId,
                name: 'Membership boundary',
                memberships: {
                    create: [
                        { id: randomUUID(), userId: admin, role: 'ADMIN' },
                        { id: moderatorId, userId: moderator, role: 'MODERATOR' },
                        { id: memberId, userId: member, role: 'MEMBER' },
                    ],
                },
            },
        });
        await createSession(api.prisma, clubId, { phase: 'COMPLETED', type: 'PAST' });
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
    });
    const remove = (userId: string, id = memberId, confirmation = 'REMOVE') =>
        api.request(`/clubs/${clubId}/members/${id}/remove`, {
            userId,
            method: 'POST',
            json: { confirmation },
        });

    it('should enforce the caller, confirmation, and protected role boundaries', async () => {
        const owner = await api.prisma.membership.findFirstOrThrow({
            where: { clubId, role: 'ADMIN' },
        });
        expect((await remove(outsider)).status).toBe(404);
        expect((await remove(member)).status).toBe(403);
        expect((await remove(admin, memberId, 'wrong')).status).toBe(409);
        expect((await remove(moderator, moderatorId)).status).toBe(409);
        expect((await remove(moderator, owner.id)).status).toBe(409);
        expect((await remove(admin, owner.id)).status).toBe(409);
        expect((await remove(admin, randomUUID())).status).toBe(409);
        expect(
            (
                await api.request(`/clubs/${clubId}/members/${memberId}/role`, {
                    userId: moderator,
                    method: 'PATCH',
                    json: { role: 'MODERATOR' },
                })
            ).status,
        ).toBe(403);
    });
    it('should project removable members with the same rule the removal endpoint enforces', async () => {
        const removable = async (userId: string) => {
            const settings = (await (
                await api.request(`/clubs/${clubId}/settings`, { userId })
            ).json()) as IClubSettings;
            return settings.members
                .filter((entry) => entry.canRemove)
                .map((entry) => entry.id)
                .toSorted((a, b) => a.localeCompare(b));
        };
        expect(await removable(admin)).toEqual(
            [memberId, moderatorId].toSorted((a, b) => a.localeCompare(b)),
        );
        expect(await removable(moderator)).toEqual([memberId]);
        expect(await removable(member)).toEqual([]);
    });
    it('should serialize repeated removal, audit once, and preserve history while revoking access', async () => {
        const responses = await Promise.all([remove(moderator), remove(admin)]);
        expect(responses.map(({ status }) => status)).toEqual([204, 204]);
        expect(await api.prisma.membership.findUnique({ where: { id: memberId } })).toMatchObject({
            status: 'REMOVED',
            role: 'MEMBER',
            leftAt: expect.any(Date),
        });
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { clubId, action: 'MEMBERSHIP_REMOVED' },
            }),
        ).toBe(1);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(1);
        await api.expectStatus(404, `/clubs/${clubId}/hub`, { userId: member });
        await api.expectStatus(404, `/clubs/${clubId}/settings`, { userId: member });
    });
    it('should resolve promotion versus removal without stale authorization or duplicate events', async () => {
        const [role, removal] = await Promise.all([
            api.request(`/clubs/${clubId}/members/${memberId}/role`, {
                userId: admin,
                method: 'PATCH',
                json: { role: 'MODERATOR' },
            }),
            remove(moderator),
        ]);
        expect([role.status, removal.status].sort((a, b) => a - b)).toEqual([204, 409]);
        const target = await api.prisma.membership.findUniqueOrThrow({ where: { id: memberId } });
        expect(
            target.status === 'REMOVED' ? target.role === 'MEMBER' : target.role === 'MODERATOR',
        ).toBe(true);
    });
    it('should allow an Admin to remove a Moderator and allow members to leave with typed confirmation', async () => {
        expect((await remove(admin, moderatorId)).status).toBe(204);
        expect(
            (
                await api.request(`/clubs/${clubId}/leave`, {
                    method: 'POST',
                    userId: member,
                    json: { confirmation: 'LEAVE' },
                })
            ).status,
        ).toBe(204);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(1);
        expect(
            (
                await api.request(`/clubs/${clubId}/leave`, {
                    method: 'POST',
                    userId: admin,
                    json: { confirmation: 'LEAVE' },
                })
            ).status,
        ).toBe(409);
    });
    it('should preserve adminless history and disable invitations and owner actions', async () => {
        await api.prisma.membership.updateMany({
            where: { clubId, role: 'ADMIN' },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const response = await api.request(`/clubs/${clubId}/settings`, { userId: moderator });
        const settings = (await response.json()) as IClubSettings;
        expect(settings.access).toEqual({
            adminless: true,
            newWorkAllowed: false,
            isAtCapacity: false,
            reasons: ['ADMINLESS'],
        });
        expect(settings.permissions).toMatchObject({
            createInvitations: false,
            manageSessions: false,
            manageRoles: false,
            manageSettings: false,
        });
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations`, {
                    method: 'POST',
                    userId: moderator,
                    json: {},
                })
            ).status,
        ).toBe(409);
        expect(
            (
                await api.request(`/clubs/${clubId}/archive`, {
                    method: 'POST',
                    userId: moderator,
                    json: { confirmation: 'ARCHIVE' },
                })
            ).status,
        ).toBe(403);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(1);
    });
    it('should pause new work over the member limit and restore it after roster recovery', async () => {
        for (let i = 0; i < 6; i++) {
            const userId = await createUser(api.prisma);
            users.push(userId);
            await addMember(api.prisma, clubId, userId);
        }
        const settings = (await (
            await api.request(`/clubs/${clubId}/settings`, { userId: admin })
        ).json()) as IClubSettings;
        expect(settings.access.reasons).toEqual(['MEMBER_LIMIT']);
        expect(settings.permissions).toMatchObject({
            createInvitations: false,
            manageMembers: true,
            participate: true,
        });
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations`, {
                    method: 'POST',
                    userId: admin,
                    json: {},
                })
            ).status,
        ).toBe(409);
        expect((await remove(admin)).status).toBe(204);
        const restored = (await (
            await api.request(`/clubs/${clubId}/settings`, { userId: admin })
        ).json()) as IClubSettings;
        expect(restored.access.newWorkAllowed).toBe(true);
    });
    it('should reject archived removal while preserving member leave access', async () => {
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await remove(admin)).status).toBe(409);
        expect(
            (
                await api.request(`/clubs/${clubId}/leave`, {
                    method: 'POST',
                    userId: member,
                    json: { confirmation: 'LEAVE' },
                })
            ).status,
        ).toBe(204);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(1);
    });
});
