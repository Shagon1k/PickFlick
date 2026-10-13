import { randomUUID } from 'node:crypto';

import { sessionSchema } from '@pickflick/contracts';

import {
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';
import { NominationDeadlines } from '../nomination-deadlines.js';

describe('NominationDeadlines', () => {
    let api: ITestApi;
    let users: string[];
    let admin: string;
    let member: string;
    let clubId: string;
    let sessionId: string;
    let movieId: string;
    let deadline: Date;
    let due: Date;
    let details: {
        scheduledAt: string;
        location: string;
        topic: string;
        notes: null;
        deadlineAt: string | null;
    };
    let worker: NominationDeadlines;
    const log = vi.fn();
    const session = () => api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const decisions = () =>
        api.prisma.nominationDeadlineDecision.findMany({
            where: { sessionId },
            include: { notifications: true },
        });
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        log.mockClear();
        admin = await createUser(api.prisma);
        member = await createUser(api.prisma);
        users = [admin, member];
        clubId = randomUUID();
        sessionId = randomUUID();
        deadline = new Date(Date.now() + 60000);
        due = new Date(deadline.getTime() + 1);
        details = {
            scheduledAt: '2090-01-01T00:00:00.000Z',
            location: 'Room',
            topic: 'Private text',
            notes: null,
            deadlineAt: deadline.toISOString(),
        };
        await api.prisma.club.create({ data: { id: clubId, name: 'Private Club' } });
        for (const [userId, role] of [
            [admin, 'ADMIN'],
            [member, 'MEMBER'],
        ] as const) {
            await api.prisma.membership.create({
                data: { id: randomUUID(), clubId, userId, role },
            });
        }
        const created = await api.request(`/clubs/${clubId}/sessions`, {
            userId: admin,
            method: 'POST',
            json: { ...details, type: 'FULL_CYCLE', movieId: null },
        });
        if (created.status !== 201) throw new Error('Fixture Session creation failed');
        sessionId = (await created.json()).id;
        for (const membership of await api.prisma.membership.findMany({ where: { clubId } })) {
            await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId: membership.id, status: 'ACCEPTED' },
            });
        }
        movieId = (await api.prisma.movie.create({ data: {} })).id;
        worker = new NominationDeadlines(api.prisma, log);
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
    });
    afterAll(async () => {
        await api.close();
    });
    const submit = (userId = member) =>
        api.request(`/sessions/${sessionId}/nominations`, {
            userId,
            method: 'POST',
            json: { movieId },
        });
    const edit = async (input = {}) =>
        api.request(`/sessions/${sessionId}`, {
            userId: admin,
            method: 'PATCH',
            json: { ...details, version: (await session()).detailsVersion, ...input },
        });
    const close = () =>
        api.request(`/sessions/${sessionId}/nominations/close`, {
            userId: admin,
            method: 'POST',
            json: { phaseVersion: 1, confirmation: 'CLOSE' },
        });
    it('should read the persisted Session deadline and execute when it is due', async () => {
        expect(await worker.execute(sessionId, 1, deadline)).toBe('EMPTY');
        expect(await decisions()).toHaveLength(1);
    });
    it('should ignore early execution', async () => {
        expect(await worker.execute(sessionId, 1, new Date(deadline.getTime() - 1))).toBe('EARLY');
        expect(await decisions()).toHaveLength(0);
    });
    it('should stay open with zero nominations and alert only operators once across restarts and unrelated edits', async () => {
        const moderator = await createUser(api.prisma);
        users.push(moderator);
        const operator = await api.prisma.membership.create({
            data: { id: randomUUID(), clubId, userId: moderator, role: 'MODERATOR' },
        });
        await worker.runOnce(due);
        expect(await session()).toMatchObject({
            phase: 'NOMINATION',
            phaseVersion: 1,
            detailsVersion: 1,
            deadlineVersion: 1,
            deadlineAt: deadline,
        });
        expect((await edit({ topic: 'Edited topic' })).status).toBe(200);
        await new NominationDeadlines(api.prisma, log).runOnce(due);
        const result = await decisions();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ outcome: 'EMPTY', nominationCount: 0 });
        expect(result[0]!.notifications).toHaveLength(2);
        expect(result[0]!.notifications.map((row) => row.membershipId)).toContain(operator.id);
        expect((await submit()).status).toBe(201);
        await worker.runOnce(due);
        expect((await session()).phase).toBe('NOMINATION');
        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'deadline.outcome', outcome: 'EMPTY', latenessMs: 1 }),
        );
        expect(JSON.stringify(log.mock.calls)).not.toContain('Private');
        expect(JSON.stringify(log.mock.calls)).not.toContain(movieId);
    });
    it('should choose the sole accepted nomination and notify accepted participants atomically', async () => {
        await submit();
        const results = await Promise.all([
            worker.execute(sessionId, 1, due),
            worker.execute(sessionId, 1, due),
        ]);
        expect(results.toSorted()).toEqual(['HANDLED', 'WATCHING']);
        expect(await session()).toMatchObject({
            phase: 'WATCHING',
            movieId,
            deadlineAt: null,
            phaseVersion: 2,
            detailsVersion: 2,
            deadlineVersion: 2,
        });
        const result = await decisions();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ outcome: 'WATCHING', nominationCount: 1 });
        expect(result[0]!.notifications).toHaveLength(2);
    });
    it('should count repeated Movies as multiple nominations and open Selection', async () => {
        await submit();
        // Seed a complete pre-existing roster to exercise the deadline path itself.
        const participant = await api.prisma.sessionParticipant.findFirstOrThrow({
            where: { sessionId, membership: { userId: admin } },
        });
        await api.prisma.nomination.create({
            data: { sessionId, participantId: participant.id, movieId },
        });
        await worker.runOnce(due);
        expect(await session()).toMatchObject({
            phase: 'SELECTION',
            movieId: null,
            phaseVersion: 2,
        });
        expect(await decisions()).toEqual([
            expect.objectContaining({ outcome: 'SELECTION', nominationCount: 2 }),
        ]);
    });
    it('should exclude departed participants nominations from the deadline decision', async () => {
        await submit();
        await api.prisma.sessionParticipant.updateMany({
            where: { sessionId, membership: { userId: member } },
            data: { status: 'LEFT' },
        });
        await worker.runOnce(due);
        expect((await session()).phase).toBe('NOMINATION');
        expect(await decisions()).toEqual([
            expect.objectContaining({ outcome: 'EMPTY', nominationCount: 0 }),
        ]);
    });
    it('should read deadline edits and ignore an old execution', async () => {
        await submit();
        const changed = new Date(deadline.getTime() + 60000);
        expect((await edit({ deadlineAt: changed.toISOString() })).status).toBe(200);
        expect(await worker.execute(sessionId, 1, due)).toBe('STALE');
        await worker.runOnce(due);
        expect(await session()).toMatchObject({ phase: 'NOMINATION', deadlineVersion: 2 });
        await worker.runOnce(new Date(changed.getTime() + 1));
        expect(await session()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
        expect(await decisions()).toEqual([expect.objectContaining({ deadlineVersion: 2 })]);
    });
    it('should allow one new empty alert after changing an already handled deadline', async () => {
        await worker.runOnce(due);
        const changed = new Date(deadline.getTime() + 60000);
        await edit({ deadlineAt: changed.toISOString() });
        await worker.runOnce(new Date(changed.getTime() + 1));
        await worker.runOnce(new Date(changed.getTime() + 2));
        expect(await decisions()).toHaveLength(2);
    });
    it('should invalidate cleared deadlines without a transition', async () => {
        await submit();
        expect((await edit({ deadlineAt: null })).status).toBe(200);
        expect(await worker.execute(sessionId, 1, due)).toBe('STALE');
        expect(await session()).toMatchObject({
            phase: 'NOMINATION',
            deadlineAt: null,
            deadlineVersion: 2,
        });
        expect(await decisions()).toHaveLength(0);
    });
    it('should invalidate cancellation and manual closure intent in the same transaction', async () => {
        await submit();
        expect((await close()).status).toBe(201);
        expect(await worker.execute(sessionId, 1, due)).toBe('STALE');
        expect(await decisions()).toHaveLength(0);
        expect(await session()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
        const cancelled = await api.request(`/sessions/${sessionId}/cancel`, {
            userId: admin,
            method: 'POST',
            json: { version: 2, confirmation: 'CANCEL' },
        });
        expect(cancelled.status).toBe(201);
        expect(await worker.execute(sessionId, 1, due)).toBe('STALE');
    });
    it('should cancel pending Nomination intent before the worker can decide', async () => {
        await submit();
        const response = await api.request(`/sessions/${sessionId}/cancel`, {
            userId: admin,
            method: 'POST',
            json: { version: 1, confirmation: 'CANCEL' },
        });
        expect(response.status).toBe(201);
        expect(await worker.execute(sessionId, 1, due)).toBe('STALE');
        await worker.runOnce(due);
        expect(await session()).toMatchObject({
            phase: 'CANCELLED',
            deadlineAt: null,
            deadlineVersion: 2,
        });
        expect(await decisions()).toHaveLength(0);
    });
    it('should serialize concurrent worker and operator closure without advancing twice', async () => {
        await submit();
        const results = await Promise.all([worker.execute(sessionId, 1, due), close()]);
        expect([201, 409]).toContain(results[1].status);
        expect(await session()).toMatchObject({
            phase: 'WATCHING',
            phaseVersion: 2,
            detailsVersion: 2,
        });
        const operatorCount = await api.prisma.clubAuditEvent.count({
            where: { sessionId, action: 'SESSION_NOMINATION_CLOSED' },
        });
        expect(operatorCount + (await decisions()).length).toBe(1);
    });
    it('should pause archived Clubs and resume their pending work after reactivation', async () => {
        await submit();
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect(await worker.execute(sessionId, 1, due)).toBe('PAUSED');
        await worker.runOnce(due);
        expect(await decisions()).toHaveLength(0);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await worker.runOnce(due);
        expect((await session()).phase).toBe('WATCHING');
    });
    it('should execute an overdue Session without scheduling intent after restart', async () => {
        await new NominationDeadlines(api.prisma, log).runOnce(due);
        await new NominationDeadlines(api.prisma, log).runOnce(due);
        expect(await decisions()).toHaveLength(1);
        expect(log).toHaveBeenCalledWith({ event: 'deadline.scan' });
    });
    it.each(['deadlineVersion', 'phase'] as const)(
        'should discard stale %s without deciding',
        async (field) => {
            await api.prisma.session.update({
                where: { id: sessionId },
                data: field === 'phase' ? { phase: 'CANCELLED' } : { deadlineVersion: 2 },
            });
            expect(await worker.execute(sessionId, 1, due)).toBe('STALE');
            expect(await decisions()).toHaveLength(0);
        },
    );
    it('should roll back phase, audit and notifications on outbox failure and retry after restart', async () => {
        await submit();
        await api.prisma.sessionProgressEvent.create({
            data: {
                sessionId,
                version: 3,
                kind: 'PROGRESS',
                phase: 'NOMINATION',
                phaseVersion: 1,
                detailsVersion: 1,
                acceptedCount: 2,
                nominatedCount: 1,
                recipientIds: [],
            },
        });
        await worker.runOnce(due);
        expect(await session()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        expect(await decisions()).toHaveLength(0);
        expect(
            await api.prisma.nominationDeadlineNotification.count({ where: { sessionId } }),
        ).toBe(0);
        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'deadline.failure', reason: 'TRANSACTION_FAILED' }),
        );
        await api.prisma.sessionProgressEvent.delete({
            where: { sessionId_version: { sessionId, version: 3 } },
        });
        await new NominationDeadlines(api.prisma, log).runOnce(due);
        expect(await session()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
        expect(await decisions()).toHaveLength(1);
    });
    it('should return the deadline transition through the existing Session projection', async () => {
        await submit();
        await worker.runOnce(due);
        const response = await api.request(`/sessions/${sessionId}`, { userId: member });
        expect(sessionSchema.parse(await response.json())).toMatchObject({
            phase: 'WATCHING',
            phaseVersion: 2,
            nominations: null,
            deadlineAt: null,
        });
    });
});
