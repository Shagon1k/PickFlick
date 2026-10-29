import { randomUUID } from 'node:crypto';

import { sessionSchema } from '@pickflick/contracts';
import { z } from 'zod';

import {
    addMember,
    createSession,
    createUser,
    findNotifiedUsers,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../../testing/integration.js';

describe('Selection completion', () => {
    let api: ITestApi;
    let users: string[];
    let clubId: string;
    let sessionId: string;
    let participants: string[];
    let nominations: string[];
    let movieIds: string[];

    beforeAll(async () => {
        api = await startTestApi();
        movieIds = await Promise.all(
            ['First', 'Second'].map(
                async (title) => (await api.prisma.movie.create({ data: { title } })).id,
            ),
        );
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 4 }, () => createUser(api.prisma)));
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Resolution Club' } });
        const memberships = [];
        for (const [index, role] of (['ADMIN', 'MEMBER', 'MODERATOR'] as const).entries())
            memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
        sessionId = (
            await createSession(api.prisma, clubId, {
                type: 'FULL_CYCLE',
                phase: 'SELECTION',
                selectionScaleMin: 0,
                selectionScaleMax: 3,
            })
        ).id;
        participants = [];
        nominations = [];
        for (const [index, membershipId] of memberships.slice(0, 2).entries()) {
            const participant = await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId, status: 'ACCEPTED' },
            });
            participants.push(participant.id);
            const nomination = await api.prisma.nomination.create({
                data: {
                    sessionId,
                    participantId: participant.id,
                    movieId: movieIds[index]!,
                    isInSelection: true,
                    submittedAt: new Date(`2026-10-${index + 10}T12:00:00Z`),
                },
            });
            nominations.push(nomination.id);
        }
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
    });
    afterAll(async () => {
        await api.prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
        await api.close();
    });

    const state = () => api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const events = () => api.prisma.sessionProgressEvent.findMany({ where: { sessionId } });
    const submit = (userId = users[0], values = [3, 1]) =>
        api.request(`/sessions/${sessionId}/selection`, {
            method: 'POST',
            userId,
            json: {
                scores: nominations.map((nominationId, index) => ({
                    nominationId,
                    score: values[index],
                })),
            },
        });
    const close = (userId = users[0], phaseVersion = 1) =>
        api.request(`/sessions/${sessionId}/selection/close`, {
            method: 'POST',
            userId,
            json: { confirmation: 'CLOSE', phaseVersion },
        });
    const leave = (userId = users[1], isClub = false) =>
        api.request(isClub ? `/clubs/${clubId}/leave` : `/sessions/${sessionId}/leave`, {
            method: 'POST',
            userId,
            json: { confirmation: 'LEAVE' },
        });

    it.each([
        { kind: 'automatic', auditCounts: [0] },
        { kind: 'manual', auditCounts: [1] },
        { kind: 'concurrent', auditCounts: [0, 1] },
    ] as const)(
        'should choose the same winner once under $kind closure and retries',
        async ({ kind, auditCounts }) => {
            expect((await submit()).status).toBe(201);
            const actions = {
                automatic: () => Promise.all([submit(users[1])]),
                manual: () => Promise.all([close(users[2])]),
                concurrent: () => Promise.all([submit(users[1]), close(), close(users[2])]),
            };
            const statuses = (await actions[kind]()).map((response) => response.status);
            const expectedStatuses = {
                automatic: [[201]],
                manual: [[201]],
                concurrent: [
                    [201, 201, 201],
                    [409, 201, 201],
                ],
            };
            expect(expectedStatuses[kind]).toContainEqual(statuses);
            const saved = await state();
            expect(saved).toMatchObject({
                phase: 'WATCHING',
                phaseVersion: 2,
                detailsVersion: 2,
                movieId: movieIds[0],
            });
            expect(saved.selectionResult).toMatchObject({
                winnerNominationId: nominations[0],
                reason: 'TOTAL',
            });
            expect((await events()).filter((event) => event.phase === 'WATCHING')).toHaveLength(1);
            expect(await findNotifiedUsers(api.prisma, sessionId, 'SELECTION_CLOSED')).toEqual(
                users.slice(0, 2).toSorted((a, b) => a.localeCompare(b)),
            );
            expect((await close()).status).toBe(201);
            expect((await close(users[2])).status).toBe(201);
            expect((await submit(users[1])).status).toBe(409);
            expect(await state()).toEqual(saved);
            const auditCount = await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_SELECTION_CLOSED' },
            });
            expect(auditCounts).toContain(auditCount);
        },
    );

    it('should close with no ballots using nomination time and reject an empty nomination set', async () => {
        await api.prisma.nomination.updateMany({
            where: { sessionId },
            data: { isInSelection: false },
        });
        expect((await close()).status).toBe(409);
        expect(await state()).toMatchObject({ phase: 'SELECTION', selectionResult: null });
        await api.prisma.nomination.updateMany({
            where: { sessionId },
            data: { isInSelection: true },
        });
        expect((await close()).status).toBe(201);
        expect((await state()).selectionResult).toMatchObject({
            winnerNominationId: nominations[0],
            reason: 'NOMINATION_TIME',
            inputs: { ballots: [] },
        });
    });

    it.each([false, true])(
        'should complete after departure (Club: %s) without discarding a received ballot',
        async (isClub) => {
            expect((await submit(users[1], [0, 3])).status).toBe(201);
            expect((await leave(users[1], isClub)).status).toBe(204);
            expect(await state()).toMatchObject({ phase: 'SELECTION', phaseVersion: 1 });
            expect((await submit(users[0], [1, 0])).status).toBe(201);
            expect((await state()).selectionResult).toMatchObject({
                winnerNominationId: nominations[1],
                inputs: { acceptedParticipantIds: [participants[0]], ballots: expect.any(Array) },
            });
            expect(await api.prisma.selectionBallot.count({ where: { sessionId } })).toBe(2);
        },
    );

    it.each([false, true])(
        'should complete when the last non-submitter leaves (Club: %s)',
        async (isClub) => {
            await submit();
            expect((await leave(users[1], isClub)).status).toBe(204);
            expect(await state()).toMatchObject({
                phase: 'WATCHING',
                phaseVersion: 2,
                movieId: movieIds[0],
            });
            expect((await events()).filter((event) => event.kind === 'AUTOMATIC')).toHaveLength(1);
        },
    );

    it('should evaluate the roster after operator removal', async () => {
        await submit();
        expect(
            (
                await api.request(`/sessions/${sessionId}/participants/${participants[1]}/remove`, {
                    method: 'POST',
                    userId: users[2],
                    json: { confirmation: 'REMOVE' },
                })
            ).status,
        ).toBe(204);
        expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
    });

    it('should keep zero accepted participants open until an operator closes over eligible nominations', async () => {
        expect((await leave()).status).toBe(204);
        expect((await leave(users[0])).status).toBe(204);
        expect(await state()).toMatchObject({ phase: 'SELECTION', phaseVersion: 1 });
        expect((await close(users[2])).status).toBe(201);
        expect((await state()).selectionResult).toMatchObject({
            inputs: { acceptedParticipantIds: [], ballots: [] },
        });
    });

    it('should pause completion while archived and evaluate it on reactivation', async () => {
        await submit();
        expect(
            (
                await api.request(`/clubs/${clubId}/archive`, {
                    method: 'POST',
                    userId: users[0],
                    json: { confirmation: 'ARCHIVE' },
                })
            ).status,
        ).toBe(204);
        await leave();
        expect(await state()).toMatchObject({ phase: 'SELECTION', selectionResult: null });
        await api.expectStatus(204, `/clubs/${clubId}/reactivate`, {
            method: 'POST',
            userId: users[0],
        });
        expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
    });

    it('should serialize final submission against roster departure', async () => {
        await submit();
        const [submission, departure] = await Promise.all([submit(users[1]), leave()]);
        expect([201, 409]).toContain(submission.status);
        expect(departure.status).toBe(204);
        expect(await state()).toMatchObject({
            phase: 'WATCHING',
            phaseVersion: 2,
            movieId: movieIds[0],
        });
        expect((await events()).filter((event) => event.kind === 'AUTOMATIC')).toHaveLength(1);
    });

    it.each(['automatic', 'manual'])(
        'should roll back %s closure if the outbox write fails',
        async (kind) => {
            await submit();
            await api.prisma.sessionProgressEvent.create({
                data: {
                    sessionId,
                    version: 3,
                    kind: 'PROGRESS',
                    phase: 'SELECTION',
                    phaseVersion: 1,
                    detailsVersion: 1,
                    acceptedCount: 2,
                    nominatedCount: 2,
                    recipientIds: [],
                },
            });
            const complete = () => (kind === 'automatic' ? submit(users[1]) : close());
            expect((await complete()).status).toBe(500);
            expect(await state()).toMatchObject({
                phase: 'SELECTION',
                selectionResult: null,
                phaseVersion: 1,
                progressVersion: 2,
            });
            expect(await api.prisma.selectionBallot.count({ where: { sessionId } })).toBe(1);
            await api.prisma.sessionProgressEvent.delete({
                where: { sessionId_version: { sessionId, version: 3 } },
            });
            expect((await complete()).status).toBe(201);
            expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
        },
    );

    it('should evaluate a retained ballot when its participant rejoins Selection', async () => {
        await submit(users[1]);
        await leave();
        await leave(users[0]);
        const membership = await api.prisma.membership.findFirstOrThrow({
            where: { clubId, userId: users[1] },
        });
        const invitation = await api.request(`/sessions/${sessionId}/invitations`, {
            method: 'POST',
            userId: users[2],
            json: { membershipId: membership.id },
        });
        expect(invitation.status).toBe(201);
        const { id } = z.object({ id: z.uuid() }).parse(await invitation.json());
        const response = await api.request(`/session-invitations/${id}/respond`, {
            method: 'POST',
            userId: users[1],
            json: { decision: 'accept' },
        });
        expect(response.status).toBe(200);
        expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2 });
        expect(await api.prisma.selectionBallot.count({ where: { sessionId } })).toBe(1);
    });

    it('should preserve the snapshot against later source edits and reject changing its winner in PostgreSQL', async () => {
        await submit();
        await close();
        const saved = await state();
        await api.prisma.nomination.update({
            where: { id: nominations[0] },
            data: { submittedAt: new Date() },
        });
        await api.prisma.selectionScore.updateMany({ where: { sessionId }, data: { score: 0 } });
        await api.prisma.movieExternalId.create({
            data: { movieId: movieIds[1]!, source: 'tmdb', externalId: '46' },
        });
        expect((await close()).status).toBe(201);
        expect((await state()).selectionResult).toEqual(saved.selectionResult);
        await expect(
            api.prisma.session.update({ where: { id: sessionId }, data: { selectionResult: {} } }),
        ).rejects.toThrow('Selection result and winner are immutable');
        await expect(
            api.prisma
                .$executeRaw`UPDATE "Session" SET "selectionResult" = NULL WHERE id = ${sessionId}::uuid`,
        ).rejects.toThrow('Selection result and winner are immutable');
        await expect(
            api.prisma.session.update({ where: { id: sessionId }, data: { movieId: movieIds[1] } }),
        ).rejects.toThrow('Selection result and winner are immutable');
        const response = await api.request(`/sessions/${sessionId}`, { userId: users[1] });
        const body: unknown = await response.json();
        expect(sessionSchema.parse(body).selection).toBeNull();
        expect(body).not.toHaveProperty('selectionResult');
    });

    it('should enforce operator authorization, strict input, phase version and Club lifecycle', async () => {
        expect(
            (
                await api.request(`/sessions/${sessionId}/selection/close`, {
                    method: 'POST',
                    json: { confirmation: 'CLOSE', phaseVersion: 1 },
                })
            ).status,
        ).toBe(401);
        expect((await close(users[3])).status).toBe(404);
        expect((await close(users[1])).status).toBe(403);
        expect((await close(users[0], 2)).status).toBe(409);
        expect(
            (
                await api.request(`/sessions/${sessionId}/selection/close`, {
                    method: 'POST',
                    userId: users[0],
                    json: { confirmation: 'YES', phaseVersion: 1 },
                })
            ).status,
        ).toBe(400);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await close()).status).toBe(409);
        expect(await state()).toMatchObject({ phase: 'SELECTION', selectionResult: null });
    });
});
