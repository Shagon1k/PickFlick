import { randomUUID } from 'node:crypto';

import type { ICreatedInvitation, TInvitationPreview } from '@pickflick/contracts';

import {
    addMember,
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../../testing/integration.js';

describe('Club invitations', () => {
    let api: ITestApi;
    let users: string[];
    let admin: string;
    let recipient: string;
    let outsider: string;
    let clubId: string;

    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 3 }, () => createUser(api.prisma)));
        [admin, recipient, outsider] = users as [string, string, string];
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Private invitation Club' } });
        await addMember(api.prisma, clubId, admin, 'ADMIN');
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
    });
    afterAll(async () => {
        await api.close();
    });

    async function create(targetUserId?: string): Promise<ICreatedInvitation> {
        const response = await api.request(`/clubs/${clubId}/invitations`, {
            userId: admin,
            method: 'POST',
            json: targetUserId ? { targetUserId } : {},
        });
        expect(response.status).toBe(201);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        return response.json() as Promise<ICreatedInvitation>;
    }
    async function preview(token: string, userId = recipient) {
        const response = await api.request('/club-invitations/preview', {
            userId,
            method: 'POST',
            json: { token },
        });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        return response.json() as Promise<TInvitationPreview>;
    }
    async function respond(token: string, decision = 'accept', userId = recipient) {
        const response = await api.request('/club-invitations/respond', {
            userId,
            method: 'POST',
            json: { token, decision },
        });
        expect(response.status).toBe(200);
        return response.json() as Promise<TInvitationPreview>;
    }
    async function fill(seats: number) {
        const extra = await Promise.all(
            Array.from({ length: seats }, () => createUser(api.prisma)),
        );
        users.push(...extra);
        await api.prisma.membership.createMany({
            data: extra.map((userId) => ({
                id: randomUUID(),
                clubId,
                userId,
                role: 'MEMBER' as const,
            })),
        });
    }

    it('should store only a high-entropy digest and restrict creation, revocation, and previews', async () => {
        const invitation = await create(recipient);
        const stored = await api.prisma.clubInvite.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
        expect(stored.tokenDigest).toMatch(/^[0-9a-f]{64}$/u);
        expect(JSON.stringify(stored)).not.toContain(invitation.token);
        expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBeGreaterThan(
            6 * 24 * 60 * 60 * 1000,
        );
        expect(await preview(invitation.token)).toMatchObject({
            state: 'valid',
            clubName: 'Private invitation Club',
            memberCount: 1,
        });
        expect(await preview(invitation.token, outsider)).toEqual({ state: 'invalid' });
        expect(await respond(invitation.token, 'accept', outsider)).toEqual({ state: 'invalid' });
        for (const path of [
            `/clubs/${clubId}/invitations`,
            `/clubs/${clubId}/invitations/${invitation.id}/revoke`,
        ]) {
            expect(
                (await api.request(path, { userId: outsider, method: 'POST', json: {} })).status,
            ).toBe(404);
        }
        expect(
            (
                await api.request('/club-invitations/preview', {
                    method: 'POST',
                    json: { token: invitation.token },
                })
            ).status,
        ).toBe(401);
        expect(
            (
                await api.request('/club-invitations/respond', {
                    method: 'POST',
                    json: { token: invitation.token, decision: 'accept' },
                })
            ).status,
        ).toBe(401);
        expect(
            (
                await api.request('/club-invitations/preview', {
                    userId: recipient,
                    method: 'POST',
                    json: { token: 'bad' },
                })
            ).status,
        ).toBe(400);
        const listed = await api.request(`/clubs/${clubId}/invitations`, { userId: admin });
        expect(await listed.text()).not.toContain(invitation.token);
    });

    it('should keep older pending invitations reachable after twenty newer links are revoked', async () => {
        const original = await create();
        for (let index = 0; index < 20; index++) {
            const newer = await create();
            expect(
                (
                    await api.request(`/clubs/${clubId}/invitations/${newer.id}/revoke`, {
                        userId: admin,
                        method: 'POST',
                    })
                ).status,
            ).toBe(204);
        }

        const response = await api.request(`/clubs/${clubId}/invitations`, { userId: admin });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(
            expect.arrayContaining([
                { id: original.id, expiresAt: original.expiresAt, state: 'pending' },
            ]),
        );
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations/${original.id}/revoke`, {
                    userId: admin,
                    method: 'POST',
                })
            ).status,
        ).toBe(204);
        expect(await preview(original.token)).toEqual({ state: 'revoked' });
    });

    it('should return every pending invitation even when there are more than twenty', async () => {
        const created = await Promise.all(
            Array.from({ length: 21 }, () =>
                api.prisma.clubInvite.create({
                    data: {
                        clubId,
                        inviterId: admin,
                        tokenDigest: randomUUID().replaceAll('-', '').repeat(2),
                        expiresAt: new Date(Date.now() + 86_400_000),
                    },
                }),
            ),
        );

        const response = await api.request(`/clubs/${clubId}/invitations`, { userId: admin });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(
            expect.arrayContaining(
                created.map((invite) => ({
                    id: invite.id,
                    expiresAt: invite.expiresAt.toISOString(),
                    state: 'pending',
                })),
            ),
        );
    });

    it('should serialize the active-link limit and allow creation after revocation', async () => {
        const invitations = [];
        for (let index = 0; index < 7; index++) invitations.push(await create());
        const responses = await Promise.all(
            Array.from({ length: 2 }, () =>
                api.request(`/clubs/${clubId}/invitations`, {
                    userId: admin,
                    method: 'POST',
                    json: {},
                }),
            ),
        );
        expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
            201, 409,
        ]);
        const denied = responses.find((response) => response.status === 409)!;
        expect(await denied.json()).toMatchObject({
            error: { reason: 'INVITATION_LIMIT_REACHED' },
        });
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations/${invitations[0]!.id}/revoke`, {
                    userId: admin,
                    method: 'POST',
                })
            ).status,
        ).toBe(204);
        await create();
        expect(
            await api.prisma.clubInvite.count({
                where: { clubId, revokedAt: null, respondedAt: null },
            }),
        ).toBe(8);
    });

    it('should create exactly one Membership and audit under concurrent acceptance', async () => {
        const invitation = await create();
        const responses = await Promise.all(
            Array.from({ length: 5 }, () => respond(invitation.token)),
        );
        expect(responses.filter(({ state }) => state === 'accepted')).toHaveLength(1);
        expect(responses.filter(({ state }) => state === 'already-member')).toHaveLength(4);
        expect(
            responses.every((response) => 'clubId' in response && response.clubId === clubId),
        ).toBe(true);
        expect(
            await api.prisma.membership.count({
                where: { clubId, userId: recipient, status: 'ACTIVE' },
            }),
        ).toBe(1);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { clubId, action: 'MEMBERSHIP_JOINED' },
            }),
        ).toBe(1);
        expect(await respond(invitation.token, 'accept', outsider)).toEqual({ state: 'invalid' });
        expect((await api.request(`/clubs/${clubId}/hub`, { userId: recipient })).status).toBe(200);
    });

    it('should serialize different links competing for the last available seat', async () => {
        await fill(6);
        const first = await create(recipient);
        const second = await create(outsider);
        const responses = await Promise.all([
            respond(first.token),
            respond(second.token, 'accept', outsider),
        ]);
        expect(responses.filter(({ state }) => state === 'accepted')).toHaveLength(1);
        expect(responses.filter(({ state }) => state === 'over-limit')).toEqual([
            { state: 'over-limit' },
        ]);
        expect(await api.prisma.membership.count({ where: { clubId, status: 'ACTIVE' } })).toBe(8);
        const creation = await api.request(`/clubs/${clubId}/invitations`, {
            userId: admin,
            method: 'POST',
            json: {},
        });
        expect(creation.status).toBe(409);
    });

    it('should consume a declined invitation without creating Membership and make retries safe', async () => {
        const invitation = await create(recipient);
        expect(await respond(invitation.token, 'decline')).toEqual({ state: 'declined' });
        expect(await respond(invitation.token)).toEqual({ state: 'declined' });
        expect(await api.prisma.membership.count({ where: { clubId, userId: recipient } })).toBe(0);
        const stored = await api.prisma.clubInvite.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(stored).toMatchObject({ responderId: recipient, accepted: false });
        expect(stored.respondedAt).toBeInstanceOf(Date);
    });

    it('should revoke idempotently and show only safe invalid, expired, and revoked states', async () => {
        const invitation = await create();
        for (let index = 0; index < 2; index++) {
            expect(
                (
                    await api.request(`/clubs/${clubId}/invitations/${invitation.id}/revoke`, {
                        userId: admin,
                        method: 'POST',
                    })
                ).status,
            ).toBe(204);
        }
        expect(await preview(invitation.token)).toEqual({ state: 'revoked' });
        expect(await respond(invitation.token)).toEqual({ state: 'revoked' });
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { clubId, action: 'CLUB_INVITE_REVOKED' },
            }),
        ).toBe(1);
        const expired = await create();
        await api.prisma.clubInvite.update({
            where: { id: expired.id },
            data: {
                createdAt: new Date(Date.now() - 3_600_000),
                expiresAt: new Date(Date.now() - 1000),
            },
        });
        expect(await preview(expired.token)).toEqual({ state: 'expired' });
        expect(await respond(expired.token)).toEqual({ state: 'expired' });
        expect(await preview('x'.repeat(43))).toEqual({ state: 'invalid' });
    });

    it('should refuse read-only and deleted Clubs and require manager authorization', async () => {
        const invitation = await create();
        await addMember(api.prisma, clubId, recipient);
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations`, {
                    userId: recipient,
                    method: 'POST',
                    json: {},
                })
            ).status,
        ).toBe(403);
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations/${invitation.id}/revoke`, {
                    userId: recipient,
                    method: 'POST',
                })
            ).status,
        ).toBe(403);
        expect(await preview(invitation.token)).toEqual({ state: 'already-member', clubId });
        await api.prisma.membership.updateMany({
            where: { clubId, userId: recipient },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        await api.prisma.membership.updateMany({
            where: { clubId, userId: admin },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        expect(await respond(invitation.token)).toEqual({ state: 'unavailable' });
        await api.prisma.membership.updateMany({
            where: { clubId, userId: admin },
            data: { status: 'ACTIVE', leftAt: null },
        });
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect(await respond(invitation.token)).toEqual({ state: 'unavailable' });
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations`, {
                    userId: admin,
                    method: 'POST',
                    json: {},
                })
            ).status,
        ).toBe(409);
        await api.prisma.club.update({ where: { id: clubId }, data: { deletedAt: new Date() } });
        expect(await preview(invitation.token)).toEqual({ state: 'invalid' });
    });

    it('should serialize acceptance with revocation and enforce invitation persistence constraints', async () => {
        const invitation = await create();
        const [answer, revoked] = await Promise.all([
            respond(invitation.token),
            api.request(`/clubs/${clubId}/invitations/${invitation.id}/revoke`, {
                userId: admin,
                method: 'POST',
            }),
        ]);
        expect(revoked.status).toBe(204);
        expect(['accepted', 'revoked']).toContain(answer.state);
        expect(
            await api.prisma.membership.count({
                where: { clubId, userId: recipient, status: 'ACTIVE' },
            }),
        ).toBe(answer.state === 'accepted' ? 1 : 0);
        const stored = await api.prisma.clubInvite.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(Boolean(stored.respondedAt) && Boolean(stored.revokedAt)).toBe(false);
        await expect(
            api.prisma.clubInvite.create({
                data: {
                    tokenDigest: 'a'.repeat(64),
                    clubId,
                    inviterId: admin,
                    expiresAt: new Date(Date.now() + 60_000),
                    accepted: true,
                },
            }),
        ).rejects.toThrow('ClubInvite_response');
        await expect(
            api.prisma.clubInvite.create({
                data: {
                    tokenDigest: 'b'.repeat(64),
                    clubId,
                    inviterId: admin,
                    expiresAt: new Date(Date.now() - 60_000),
                },
            }),
        ).rejects.toThrow('ClubInvite_expiry');
    });

    it('should preserve historical Membership on rejoining and issue links for Moderators', async () => {
        const oldId = randomUUID();
        await api.prisma.membership.create({
            data: { id: oldId, clubId, userId: recipient, status: 'LEFT', leftAt: new Date() },
        });
        const invitation = await create();
        expect(await respond(invitation.token)).toEqual({ state: 'accepted', clubId });
        expect(
            (await api.prisma.membership.findUniqueOrThrow({ where: { id: oldId } })).status,
        ).toBe('LEFT');
        await api.prisma.membership.updateMany({
            where: { clubId, userId: recipient, status: 'ACTIVE' },
            data: { role: 'MODERATOR' },
        });
        expect(
            (
                await api.request(`/clubs/${clubId}/invitations`, {
                    userId: recipient,
                    method: 'POST',
                    json: {},
                })
            ).status,
        ).toBe(201);
    });
});
