import { randomUUID } from 'node:crypto';

import type { ICreatedInvitation, IPendingClubInvitation } from '@pickflick/contracts';

import {
    addMember,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';

describe('Pending Club invitations', () => {
    let api: ITestApi;
    let users: string[];
    let owner: string;
    let target: string;
    let other: string;
    let clubId: string;
    beforeAll(async () => {
        api = await startTestApi();
    });
    afterAll(async () => {
        await api.close();
    });
    beforeEach(async () => {
        owner = await createUser(api.prisma);
        target = await createUser(api.prisma);
        other = await createUser(api.prisma);
        users = [owner, target, other];
        clubId = randomUUID();
        await api.prisma.club.create({
            data: {
                id: clubId,
                name: 'Private invitation',
                memberships: { create: { id: randomUUID(), userId: owner, role: 'ADMIN' } },
            },
        });
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
    });
    async function create(targetUserId?: string): Promise<ICreatedInvitation> {
        return (await (
            await api.request(`/clubs/${clubId}/invitations`, {
                method: 'POST',
                userId: owner,
                json: { targetUserId },
            })
        ).json()) as ICreatedInvitation;
    }
    const list = (userId: string) => api.request('/club-invitations/pending', { userId });
    const respond = (userId: string, id: string, decision = 'accept') =>
        api.request(`/club-invitations/${id}/respond`, {
            userId,
            method: 'POST',
            json: { decision },
        });
    it('should disclose only eligible invitations targeted to the signed-in account without token material', async () => {
        const targeted = await create(target);
        await create();
        await create(other);
        const response = await list(target);
        const pending = (await response.json()) as IPendingClubInvitation[];
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(pending).toEqual([
            {
                id: targeted.id,
                clubName: 'Private invitation',
                memberCount: 1,
                inviterName: 'Test User',
                expiresAt: targeted.expiresAt,
            },
        ]);
        expect(JSON.stringify(pending)).not.toContain(targeted.token);
        await api.expectStatus(401, '/club-invitations/pending');
        expect(await (await respond(other, targeted.id)).json()).toEqual({ state: 'invalid' });
        expect(await (await respond(target, randomUUID())).json()).toEqual({ state: 'invalid' });
    });
    it('should accept once across simultaneous token and ticket responses and route retries to the authorized Hub', async () => {
        const invitation = await create(target);
        const results = await Promise.all([
            respond(target, invitation.id),
            api.request('/club-invitations/respond', {
                method: 'POST',
                userId: target,
                json: { token: invitation.token, decision: 'accept' },
            }),
        ]);
        const bodies = await Promise.all(results.map((result) => result.json()));
        expect(bodies).toContainEqual({ state: 'accepted', clubId });
        expect(bodies).toContainEqual({ state: 'already-member', clubId });
        expect(
            await api.prisma.membership.count({
                where: { clubId, userId: target, status: 'ACTIVE' },
            }),
        ).toBe(1);
        expect(await (await list(target)).json()).toEqual([]);
    });
    it('should decline without creating a Membership and remove the row from pending invites', async () => {
        const invitation = await create(target);
        expect(await (await respond(target, invitation.id, 'decline')).json()).toEqual({
            state: 'declined',
        });
        expect(await (await list(target)).json()).toEqual([]);
        expect(await api.prisma.membership.count({ where: { clubId, userId: target } })).toBe(0);
    });
    it('should hide revoked, expired, archived, adminless, full, and deleted Clubs and recheck stale ticket responses', async () => {
        const revoked = await create(target);
        const expired = await create(target);
        const live = await create(target);
        await api.prisma.clubInvite.update({
            where: { id: revoked.id },
            data: { revokedAt: new Date() },
        });
        await api.prisma.clubInvite.update({
            where: { id: expired.id },
            data: {
                createdAt: new Date(Date.now() - 10000),
                expiresAt: new Date(Date.now() - 5000),
            },
        });
        expect(
            ((await (await list(target)).json()) as IPendingClubInvitation[]).map(({ id }) => id),
        ).toEqual([live.id]);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect(await (await list(target)).json()).toEqual([]);
        expect(await (await respond(target, live.id)).json()).toEqual({ state: 'unavailable' });
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await api.prisma.membership.updateMany({
            where: { clubId },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        expect(await (await list(target)).json()).toEqual([]);
        expect(await (await respond(target, live.id)).json()).toEqual({ state: 'unavailable' });
        await api.prisma.membership.updateMany({
            where: { clubId },
            data: { status: 'ACTIVE', leftAt: null },
        });
        for (let i = 0; i < 7; i++) {
            const userId = await createUser(api.prisma);
            users.push(userId);
            await addMember(api.prisma, clubId, userId);
        }
        expect(await (await list(target)).json()).toEqual([]);
        expect(await (await respond(target, live.id)).json()).toEqual({ state: 'over-limit' });
        await api.prisma.club.update({
            where: { id: clubId },
            data: { deletedAt: new Date(), lifecycle: 'ARCHIVED' },
        });
        expect(await (await list(target)).json()).toEqual([]);
        expect(await (await respond(target, live.id)).json()).toEqual({ state: 'invalid' });
    });
});
