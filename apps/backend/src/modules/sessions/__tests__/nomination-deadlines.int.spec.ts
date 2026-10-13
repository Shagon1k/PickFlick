import { randomUUID } from 'node:crypto';

import { sessionSchema } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import {
    addMember,
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
    const key = () => ({ sessionId_deadlineVersion: { sessionId, deadlineVersion: 1 } });
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
            await addMember(api.prisma, clubId, userId, role);
        }
        const created = await api.request(`/clubs/${clubId}/sessions`, {
            userId: admin,
            method: 'POST',
            json: { ...details, type: 'FULL_CYCLE', movieId: null },
        });
        if (created.status !== 201) throw new Error('Fixture Session creation failed');
        sessionId = ((await created.json()) as { id: string }).id;
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
    it('should schedule stable intent with Session creation and wait until the deadline', async () => {
        expect(
            await api.prisma.nominationDeadlineJob.findUniqueOrThrow({ where: key() }),
        ).toMatchObject({ phaseVersion: 1, deadlineAt: deadline, finishedAt: null });
        expect(await worker.execute(sessionId, 1, deadline)).toBe('EMPTY');
        expect(await decisions()).toHaveLength(1);
    });
    it('should ignore early execution and keep its intent pending', async () => {
        expect(await worker.execute(sessionId, 1, new Date(deadline.getTime() - 1))).toBe('EARLY');
        expect(await decisions()).toHaveLength(0);
        expect(
            await api.prisma.nominationDeadlineJob.findUniqueOrThrow({ where: key() }),
        ).toMatchObject({ finishedAt: null });
    });
    it('should stay open with zero nominations and alert only operators once across restarts and unrelated edits', async () => {
        const moderator = await createUser(api.prisma);
        users.push(moderator);
        const operator = await addMember(api.prisma, clubId, moderator, 'MODERATOR');
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
        expect(result[0]!.notifications.map((row) => row.membershipId)).toContain(operator);
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
    it('should replace intent on deadline edits and ignore an old execution', async () => {
        await submit();
        const changed = new Date(deadline.getTime() + 60000);
        expect((await edit({ deadlineAt: changed.toISOString() })).status).toBe(200);
        expect(await worker.execute(sessionId, 1, due)).toBe('HANDLED');
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
        expect(await worker.execute(sessionId, 1, due)).toBe('HANDLED');
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
        expect(await worker.execute(sessionId, 1, due)).toBe('HANDLED');
        expect(await decisions()).toHaveLength(0);
        expect(await session()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
        const cancelled = await api.request(`/sessions/${sessionId}/cancel`, {
            userId: admin,
            method: 'POST',
            json: { version: 2, confirmation: 'CANCEL' },
        });
        expect(cancelled.status).toBe(201);
        expect(await worker.execute(sessionId, 1, due)).toBe('HANDLED');
    });
    it('should cancel pending Nomination intent before the worker can decide', async () => {
        await submit();
        const response = await api.request(`/sessions/${sessionId}/cancel`, {
            userId: admin,
            method: 'POST',
            json: { version: 1, confirmation: 'CANCEL' },
        });
        expect(response.status).toBe(201);
        expect(await worker.execute(sessionId, 1, due)).toBe('HANDLED');
        await worker.runOnce(due);
        expect(await session()).toMatchObject({
            phase: 'CANCELLED',
            deadlineAt: null,
            deadlineVersion: 2,
        });
        expect(await decisions()).toHaveLength(0);
    });
    it('should roll back deadline edits and invalidation when replacement intent cannot be stored', async () => {
        await api.prisma.$executeRawUnsafe(
            `CREATE FUNCTION pf43_fail_schedule() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sessionId" = '${sessionId}'::uuid THEN RAISE EXCEPTION 'schedule failed'; END IF; RETURN NEW; END $$`,
        );
        await api.prisma.$executeRawUnsafe(
            'CREATE TRIGGER pf43_fail_schedule BEFORE INSERT ON "NominationDeadlineJob" FOR EACH ROW EXECUTE FUNCTION pf43_fail_schedule()',
        );
        try {
            const response = await edit({
                deadlineAt: new Date(deadline.getTime() + 60000).toISOString(),
            });
            expect(response.status).toBe(500);
            expect(await session()).toMatchObject({
                deadlineAt: deadline,
                deadlineVersion: 1,
                detailsVersion: 1,
            });
            expect(
                await api.prisma.nominationDeadlineJob.findUniqueOrThrow({ where: key() }),
            ).toMatchObject({ finishedAt: null });
            expect(
                await api.prisma.clubAuditEvent.count({
                    where: { sessionId, action: 'SESSION_UPDATED' },
                }),
            ).toBe(0);
        } finally {
            await api.prisma.$executeRawUnsafe(
                'DROP TRIGGER pf43_fail_schedule ON "NominationDeadlineJob"',
            );
            await api.prisma.$executeRawUnsafe('DROP FUNCTION pf43_fail_schedule()');
        }
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
        expect(
            await api.prisma.nominationDeadlineJob.findUniqueOrThrow({ where: key() }),
        ).toMatchObject({ finishedAt: null });
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await worker.runOnce(due);
        expect((await session()).phase).toBe('WATCHING');
    });
    it('should observably repair missing overdue intent and preserve completed intent', async () => {
        await api.prisma.nominationDeadlineJob.delete({ where: key() });
        await worker.runOnce(new Date(deadline.getTime() - 1));
        expect(await api.prisma.nominationDeadlineJob.count({ where: { sessionId } })).toBe(0);
        await worker.runOnce(due);
        expect(log).toHaveBeenCalledWith({ event: 'deadline.repaired', sessionId });
        expect(log).toHaveBeenCalledWith({ event: 'deadline.reconciliation', repaired: 1 });
        await new NominationDeadlines(api.prisma, log).runOnce(due);
        expect(await decisions()).toHaveLength(1);
        expect(log).toHaveBeenLastCalledWith({ event: 'deadline.reconciliation', repaired: 0 });
    });
    it.each(['deadlineVersion', 'phaseVersion', 'deadlineAt', 'phase'] as const)(
        'should discard stale %s guards without deciding',
        async (field) => {
            const data: Prisma.SessionUpdateInput = {};
            if (field === 'deadlineAt') data.deadlineAt = new Date(deadline.getTime() + 1000);
            else if (field === 'phase') data.phase = 'CANCELLED';
            else data[field] = 2;
            await api.prisma.session.update({ where: { id: sessionId }, data });
            expect(await worker.execute(sessionId, 1, due)).toBe('STALE');
            expect(await decisions()).toHaveLength(0);
        },
    );
    it('should roll back phase, audit, notifications and completion if the final job write fails and retry after restart', async () => {
        await submit();
        // A transaction-local trigger injects a real database failure at the final write.
        await api.prisma.$executeRawUnsafe(
            `CREATE FUNCTION pf43_fail_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sessionId" = '${sessionId}'::uuid THEN RAISE EXCEPTION 'private text'; END IF; RETURN NEW; END $$`,
        );
        await api.prisma.$executeRawUnsafe(
            'CREATE TRIGGER pf43_fail_completion BEFORE UPDATE ON "NominationDeadlineJob" FOR EACH ROW EXECUTE FUNCTION pf43_fail_completion()',
        );
        try {
            await worker.runOnce(due);
            expect(await session()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
            expect(await decisions()).toHaveLength(0);
            expect(
                await api.prisma.nominationDeadlineNotification.count({ where: { sessionId } }),
            ).toBe(0);
            expect(
                await api.prisma.nominationDeadlineJob.findUniqueOrThrow({ where: key() }),
            ).toMatchObject({ finishedAt: null });
            expect(log).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'deadline.failure',
                    reason: 'TRANSACTION_FAILED',
                }),
            );
            expect(JSON.stringify(log.mock.calls)).not.toContain('private text');
        } finally {
            await api.prisma.$executeRawUnsafe(
                'DROP TRIGGER pf43_fail_completion ON "NominationDeadlineJob"',
            );
            await api.prisma.$executeRawUnsafe('DROP FUNCTION pf43_fail_completion()');
        }
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
