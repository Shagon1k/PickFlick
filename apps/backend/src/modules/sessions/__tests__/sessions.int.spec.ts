import { randomUUID } from 'node:crypto';

import type { IClubHub, TSession } from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import {
    addMember,
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';

const details = {
    scheduledAt: '2026-12-01T00:00:00.000Z',
    location: 'Room A',
    topic: 'Noir night',
    notes: 'Bring snacks.',
    deadlineAt: null,
};

describe('Session workflows', () => {
    let api: ITestApi;
    let users: string[];
    let admin: string;
    let moderator: string;
    let member: string;
    let outsider: string;
    let clubId: string;
    let movieId: string;
    beforeAll(async () => {
        api = await startTestApi();
        admin = await createUser(api.prisma);
        moderator = await createUser(api.prisma);
        member = await createUser(api.prisma);
        outsider = await createUser(api.prisma);
        users = [admin, moderator, member, outsider];
        movieId = (await api.prisma.movie.create({ data: {} })).id;
    });
    beforeEach(async () => {
        clubId = randomUUID();
        await api.prisma.club.create({
            data: { id: clubId, name: 'Session Club', selectionScaleMax: 7 },
        });
        for (const [userId, role] of [
            [admin, 'ADMIN'],
            [moderator, 'MODERATOR'],
            [member, 'MEMBER'],
        ] as const) {
            await addMember(api.prisma, clubId, userId, role);
        }
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
        await api.close();
    });
    async function create(userId = admin, input = {}) {
        return api.request(`/clubs/${clubId}/sessions`, {
            userId,
            method: 'POST',
            json: { ...details, type: 'FULL_CYCLE', movieId: null, ...input },
        });
    }
    async function edit(session: TSession, userId = admin, input = {}) {
        return api.request(`/sessions/${session.id}`, {
            userId,
            method: 'PATCH',
            json: { ...details, version: session.version, ...input },
        });
    }
    async function cancel(session: TSession, userId = admin, input = {}) {
        return api.request(`/sessions/${session.id}/cancel`, {
            userId,
            method: 'POST',
            json: { version: session.version, confirmation: 'CANCEL', ...input },
        });
    }
    it('should start full-cycle in Nomination and pre-selected in Watching with saved settings', async () => {
        const first = await create();
        const session = (await first.json()) as TSession;
        expect(first.status).toBe(201);
        expect(session.phase).toBe('NOMINATION');
        expect(
            (await api.prisma.session.findUniqueOrThrow({ where: { id: session.id } }))
                .selectionScaleMax,
        ).toBe(7);
        expect((await cancel(session)).status).toBe(201);
        const preselected = await create(moderator, { type: 'PRE_SELECTED', movieId });
        expect(await preselected.json()).toMatchObject({ phase: 'WATCHING', movieId });
    });
    it('should assign a server ID and allow the Session to be read and cancelled', async () => {
        expect((await create(admin, { id: randomUUID() })).status).toBe(400);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(0);
        const created = await create();
        expect(created.status).toBe(201);
        const session = (await created.json()) as TSession;
        const retrieved = await api.request(`/sessions/${session.id}`, { userId: admin });
        expect(retrieved.status).toBe(200);
        expect(await retrieved.json()).toMatchObject({ id: session.id, phase: 'NOMINATION' });
        expect((await cancel(session)).status).toBe(201);
        expect(
            await (await api.request(`/sessions/${session.id}`, { userId: admin })).json(),
        ).toMatchObject({ phase: 'CANCELLED' });
    });
    it('should allow one blocking Session per Club, including concurrent creation', async () => {
        const first = await create();
        expect(first.status).toBe(201);
        const repeated = await create();
        expect(repeated.status).toBe(409);
        expect(await repeated.json()).toMatchObject({ error: { reason: 'BLOCKING_SESSION' } });
        await cancel((await first.json()) as TSession);
        const concurrent = await Promise.all([create(), create(moderator)]);
        expect(concurrent.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
            201, 409,
        ]);
    });
    it('should enforce membership, roles and archived/read-only boundaries', async () => {
        expect((await create(member)).status).toBe(403);
        expect((await create(outsider)).status).toBe(404);
        const session = (await (await create()).json()) as TSession;
        expect((await api.request(`/sessions/${session.id}`, { userId: outsider })).status).toBe(
            404,
        );
        expect((await edit(session, member)).status).toBe(403);
        expect((await cancel(session, member)).status).toBe(403);
        expect((await api.request(`/sessions/${session.id}`)).status).toBe(401);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await edit(session)).status).toBe(409);
        expect((await cancel(session)).status).toBe(409);
        expect(
            await (await api.request(`/sessions/${session.id}`, { userId: admin })).json(),
        ).toMatchObject({ canEdit: false, canCancel: false });
    });
    it('should reject invalid payloads and unknown Movies without inserting or auditing', async () => {
        expect((await create(admin, { type: 'PRE_SELECTED' })).status).toBe(400);
        expect((await create(admin, { location: '' })).status).toBe(400);
        expect((await create(admin, { type: 'PRE_SELECTED', movieId: randomUUID() })).status).toBe(
            409,
        );
        expect((await create(admin, { deadlineAt: '2020-01-01T00:00:00Z' })).status).toBe(409);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(0);
        expect(await api.prisma.clubAuditEvent.count({ where: { clubId } })).toBe(0);
    });
    it('should keep retry edits idempotent, prevent stale overwrites and preserve snapshots', async () => {
        const session = (await (await create()).json()) as TSession;
        const updated = await edit(session, moderator, { location: 'Room B' });
        expect(await updated.json()).toMatchObject({ location: 'Room B', version: 2 });
        expect((await edit(session, moderator, { location: 'Room B' })).status).toBe(200);
        expect((await edit(session, admin, { location: 'Room C' })).status).toBe(409);
        expect((await cancel(session)).status).toBe(409);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId: session.id, action: 'SESSION_UPDATED' },
            }),
        ).toBe(1);
        await api.prisma.club.update({ where: { id: clubId }, data: { selectionScaleMax: 9 } });
        expect(
            (await api.prisma.session.findUniqueOrThrow({ where: { id: session.id } }))
                .selectionScaleMax,
        ).toBe(7);
        const hub = (await (
            await api.request(`/clubs/${clubId}/hub`, { userId: member })
        ).json()) as IClubHub;
        expect(hub.activeSession).toMatchObject({ id: session.id, location: 'Room B' });
        const edits = await Promise.all([
            edit({ ...session, version: 2 }, admin, { notes: 'First' }),
            edit({ ...session, version: 2 }, moderator, { notes: 'Second' }),
        ]);
        expect(edits.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
            200, 409,
        ]);
    });
    it('should cancel once, preserve details and history and release the blocking slot', async () => {
        const session = (await (await create()).json()) as TSession;
        expect((await cancel(session, admin, { confirmation: '' })).status).toBe(400);
        const results = await Promise.all([cancel(session), cancel(session, moderator)]);
        expect(results.map((response) => response.status)).toEqual([201, 201]);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId: session.id, action: 'SESSION_CANCELLED' },
            }),
        ).toBe(1);
        expect(
            await (await api.request(`/sessions/${session.id}`, { userId: member })).json(),
        ).toMatchObject({ phase: 'CANCELLED', notes: details.notes, version: 2, canEdit: false });
        expect((await edit(session)).status).toBe(409);
        expect((await create()).status).toBe(201);
        const hub = (await (
            await api.request(`/clubs/${clubId}/hub`, { userId: member })
        ).json()) as IClubHub;
        expect(hub.historySessions).toEqual([
            expect.objectContaining({ id: session.id, phase: 'CANCELLED' }),
        ]);
    });
    it('should retain every Rating row independently of recent history and reject completed mutations', async () => {
        const settings = await snapshotSessionSettings(api.prisma, clubId);
        const ratingIds = Array.from({ length: 6 }, () => randomUUID());
        for (const id of ratingIds)
            await api.prisma.session.create({
                data: { id, clubId, ...settings, type: 'FULL_CYCLE', phase: 'RATING' },
            });
        const completed = await api.prisma.session.create({
            data: { id: randomUUID(), clubId, ...settings, type: 'PAST', phase: 'COMPLETED' },
        });
        expect((await create()).status).toBe(201);
        const hub = (await (
            await api.request(`/clubs/${clubId}/hub`, { userId: member })
        ).json()) as IClubHub;
        expect(
            hub.ratingSessions.map(({ id }) => id).toSorted((a, b) => a.localeCompare(b)),
        ).toEqual(ratingIds.toSorted((a, b) => a.localeCompare(b)));
        const session = (await (
            await api.request(`/sessions/${completed.id}`, { userId: admin })
        ).json()) as TSession;
        expect((await edit(session)).status).toBe(409);
        expect((await cancel(session)).status).toBe(409);
    });
    it('should edit nomination deadlines without changing phase or saved mode', async () => {
        const deadlineAt = new Date(Date.now() + 3_600_000).toISOString();
        const session = (await (await create(admin, { deadlineAt })).json()) as TSession;
        const removed = await edit(session, moderator, { deadlineAt: null });
        expect(await removed.json()).toMatchObject({
            phase: 'NOMINATION',
            deadlineAt: null,
            version: 2,
            type: 'FULL_CYCLE',
        });
        expect(
            (await edit({ ...session, version: 2 }, admin, { deadlineAt: '2020-01-01T00:00:00Z' }))
                .status,
        ).toBe(409);
        await cancel({ ...session, version: 2 });
        const watching = (await (
            await create(admin, { type: 'PRE_SELECTED', movieId })
        ).json()) as TSession;
        expect((await edit(watching, admin, { deadlineAt })).status).toBe(409);
    });
    it('should prohibit new Sessions in adminless or over-limit Clubs', async () => {
        await api.prisma.membership.updateMany({
            where: { clubId, userId: admin },
            data: { role: 'MEMBER' },
        });
        expect((await create(moderator)).status).toBe(409);
        await api.prisma.membership.updateMany({
            where: { clubId, userId: admin },
            data: { role: 'ADMIN' },
        });
        for (let index = 0; index < 6; index++) {
            const userId = await createUser(api.prisma);
            users.push(userId);
            await addMember(api.prisma, clubId, userId);
        }
        expect((await create()).status).toBe(409);
    });
});
