import { randomUUID } from 'node:crypto';

import type { IApiErrorEnvelope, IClubSettings, IClubSummary } from '@pickflick/contracts';

import {
    createUser,
    removeUsers,
    startTestApi,
    type ITestApi,
} from '../../../testing/integration.js';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]);

describe('ClubsController', () => {
    let api: ITestApi;
    let admin: string;
    let member: string;
    let outsider: string;
    let club: IClubSummary;
    let memberMembershipId: string;

    async function reasonOf(response: Response): Promise<string | undefined> {
        return ((await response.json()) as IApiErrorEnvelope).error.reason;
    }

    beforeAll(async () => {
        api = await startTestApi();
        [admin, member, outsider] = await Promise.all([
            createUser(api.prisma),
            createUser(api.prisma),
            createUser(api.prisma),
        ]);
        const created = await api.request('/clubs', {
            method: 'POST',
            userId: admin,
            json: { name: ' Midnight Society ', selectionScaleMin: 0, selectionScaleMax: 7 },
        });
        club = (await created.json()) as IClubSummary;
        memberMembershipId = randomUUID();
        await api.prisma.membership.create({
            data: { id: memberMembershipId, clubId: club.id, userId: member, role: 'MEMBER' },
        });
    });

    afterAll(async () => {
        await removeUsers(api.prisma, [admin, member, outsider]);
        await api.close();
    });

    it('should reject a request without a session', async () => {
        expect((await api.request('/clubs')).status).toBe(401);
    });

    describe('when creating a Club', () => {
        it('should store the trimmed Club with the creator as Admin', async () => {
            expect(club).toMatchObject({
                name: 'Midnight Society',
                membershipRole: 'ADMIN',
                tier: 'FREE',
            });
            const list = (await (
                await api.request('/clubs', { userId: admin })
            ).json()) as IClubSummary[];
            expect(list.map(({ id }) => id)).toEqual([club.id]);
        });

        it('should stop a Free Admin at one active Club', async () => {
            const response = await api.request('/clubs', {
                method: 'POST',
                userId: admin,
                json: { name: 'Second Club', selectionScaleMin: 1, selectionScaleMax: 5 },
            });

            expect(response.status).toBe(409);
            expect(await reasonOf(response)).toBe('ADMIN_CLUB_LIMIT_REACHED');
        });

        it('should reject an invalid body', async () => {
            const response = await api.request('/clubs', {
                method: 'POST',
                userId: outsider,
                json: { name: 'No', selectionScaleMin: 2, selectionScaleMax: 5 },
            });

            expect(response.status).toBe(400);
        });
    });

    describe('when reading settings', () => {
        it('should hide the Club from a non-member', async () => {
            expect(
                (await api.request(`/clubs/${club.id}/settings`, { userId: outsider })).status,
            ).toBe(404);
        });

        it('should give a member a read-only view without the audit trail', async () => {
            const settings = (await (
                await api.request(`/clubs/${club.id}/settings`, { userId: member })
            ).json()) as IClubSettings;

            expect(settings.permissions).toMatchObject({ manageSettings: false, leaveClub: true });
            expect(settings.members).toHaveLength(2);
            expect(settings.auditEvents).toEqual([]);
        });
    });

    describe('when updating settings', () => {
        const settings = {
            name: 'Midnight Society Updated',
            selectionScaleMin: 0,
            selectionScaleMax: 7,
            showNominationAuthors: true,
            showNominationsBeforeSubmit: true,
            showVoteResults: false,
            showRatingResults: false,
            useMonochromeMedia: true,
        };

        it('should let the Admin save and record an audit event', async () => {
            const response = await api.request(`/clubs/${club.id}/settings`, {
                method: 'PATCH',
                userId: admin,
                json: settings,
            });
            const saved = (await response.json()) as IClubSettings;

            expect(saved.club.name).toBe('Midnight Society Updated');
            expect(saved.visibility.showRatingResults).toBe(false);
            expect(saved.auditEvents[0]?.action).toBe('CLUB_SETTINGS_UPDATED');
        });

        it('should refuse a member', async () => {
            const response = await api.request(`/clubs/${club.id}/settings`, {
                method: 'PATCH',
                userId: member,
                json: settings,
            });

            expect(response.status).toBe(403);
        });

        it('should keep vote results hidden on a Free Club', async () => {
            const response = await api.request(`/clubs/${club.id}/settings`, {
                method: 'PATCH',
                userId: admin,
                json: { ...settings, showVoteResults: true },
            });

            expect(await reasonOf(response)).toBe('TIER_SETTING_UNAVAILABLE');
        });
    });

    describe('when changing a role', () => {
        it('should promote a member to Moderator', async () => {
            const response = await api.request(
                `/clubs/${club.id}/members/${memberMembershipId}/role`,
                {
                    method: 'PATCH',
                    userId: admin,
                    json: { role: 'MODERATOR' },
                },
            );
            const membership = await api.prisma.membership.findUnique({
                where: { id: memberMembershipId },
            });

            expect(response.status).toBe(204);
            expect(membership?.role).toBe('MODERATOR');
        });

        it('should never change the Admin through this route', async () => {
            const adminMembership = await api.prisma.membership.findFirstOrThrow({
                where: { clubId: club.id, userId: admin },
            });
            const response = await api.request(
                `/clubs/${club.id}/members/${adminMembership.id}/role`,
                {
                    method: 'PATCH',
                    userId: admin,
                    json: { role: 'MEMBER' },
                },
            );

            expect(await reasonOf(response)).toBe('MEMBERSHIP_INELIGIBLE');
        });
    });

    describe('when managing the avatar', () => {
        it('should reject bytes that do not match the declared type', async () => {
            const response = await api.request(`/clubs/${club.id}/avatar`, {
                method: 'PUT',
                userId: admin,
                headers: { 'content-type': 'image/png' },
                body: Buffer.from('not an image'),
            });

            expect(response.status).toBe(400);
        });

        it('should store, replace, serve, and remove the avatar', async () => {
            const upload = () =>
                api.request(`/clubs/${club.id}/avatar`, {
                    method: 'PUT',
                    userId: admin,
                    headers: { 'content-type': 'image/png' },
                    body: PNG,
                });

            expect((await upload()).status).toBe(204);
            expect((await upload()).status).toBe(204);
            expect(api.storage.objects.size).toBe(1);

            const served = await api.request(`/clubs/${club.id}/avatar`, { userId: member });
            expect(served.headers.get('content-type')).toBe('image/png');

            expect(
                (await api.request(`/clubs/${club.id}/avatar`, { method: 'DELETE', userId: admin }))
                    .status,
            ).toBe(204);
            expect(api.storage.objects.size).toBe(0);
            expect((await api.request(`/clubs/${club.id}/avatar`, { userId: member })).status).toBe(
                404,
            );
        });
    });

    describe('when changing the lifecycle', () => {
        it('should require the typed confirmation to archive', async () => {
            const response = await api.request(`/clubs/${club.id}/archive`, {
                method: 'POST',
                userId: admin,
                json: { confirmation: 'archive' },
            });

            expect(await reasonOf(response)).toBe('CONFIRMATION_MISMATCH');
        });

        it('should archive, block edits, and count against the limit again on reactivation', async () => {
            const archive = await api.request(`/clubs/${club.id}/archive`, {
                method: 'POST',
                userId: admin,
                json: { confirmation: 'ARCHIVE' },
            });
            expect(archive.status).toBe(204);

            const edit = await api.request(`/clubs/${club.id}/members/${memberMembershipId}/role`, {
                method: 'PATCH',
                userId: admin,
                json: { role: 'MEMBER' },
            });
            expect(await reasonOf(edit)).toBe('CLUB_ARCHIVED');

            const second = await api.request('/clubs', {
                method: 'POST',
                userId: admin,
                json: { name: 'Second Club', selectionScaleMin: 1, selectionScaleMax: 5 },
            });
            expect(second.status).toBe(201);

            const reactivate = await api.request(`/clubs/${club.id}/reactivate`, {
                method: 'POST',
                userId: admin,
            });
            expect(await reasonOf(reactivate)).toBe('ADMIN_CLUB_LIMIT_REACHED');
        });

        it('should keep the Admin from leaving and let a member leave', async () => {
            const adminLeave = await api.request(`/clubs/${club.id}/leave`, {
                method: 'POST',
                userId: admin,
                json: { confirmation: 'LEAVE' },
            });
            expect(await reasonOf(adminLeave)).toBe('ADMIN_MUST_TRANSFER');

            const memberLeave = await api.request(`/clubs/${club.id}/leave`, {
                method: 'POST',
                userId: member,
                json: { confirmation: 'LEAVE' },
            });
            expect(memberLeave.status).toBe(204);
            expect(
                (await api.request(`/clubs/${club.id}/settings`, { userId: member })).status,
            ).toBe(404);
        });

        it('should delete an empty Club only with its exact name', async () => {
            const wrongName = await api.request(`/clubs/${club.id}/delete`, {
                method: 'POST',
                userId: admin,
                json: { confirmation: 'midnight society updated' },
            });
            expect(await reasonOf(wrongName)).toBe('CONFIRMATION_MISMATCH');

            const deleted = await api.request(`/clubs/${club.id}/delete`, {
                method: 'POST',
                userId: admin,
                json: { confirmation: 'Midnight Society Updated' },
            });
            expect(deleted.status).toBe(204);
            expect(
                (await api.request(`/clubs/${club.id}/settings`, { userId: admin })).status,
            ).toBe(404);
        });

        it('should refuse to delete a Club with Session history', async () => {
            const [second] = (await (
                await api.request('/clubs', { userId: admin })
            ).json()) as IClubSummary[];
            await api.prisma.session.create({
                data: { id: randomUUID(), clubId: second!.id, type: 'PAST', phase: 'COMPLETED' },
            });

            const response = await api.request(`/clubs/${second!.id}/delete`, {
                method: 'POST',
                userId: admin,
                json: { confirmation: 'Second Club' },
            });

            expect(await reasonOf(response)).toBe('SESSION_HISTORY');
        });
    });
});
