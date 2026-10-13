import { randomUUID } from 'node:crypto';

import { snapshotSessionSettings } from '@pickflick/database';
import { z } from 'zod';

import {
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';
import { NominationDeadlines } from '../nomination-deadlines.js';

describe('Session progress', () => {
    let api: ITestApi;
    let users: string[];
    let clubId: string;
    let sessionId: string;
    let movieId: string;
    let memberships: string[];
    beforeAll(async () => {
        api = await startTestApi();
        users = await Promise.all([
            createUser(api.prisma),
            createUser(api.prisma),
            createUser(api.prisma),
        ]);
        movieId = (await api.prisma.movie.create({ data: {} })).id;
    });
    beforeEach(async () => {
        await api.prisma.club.updateMany({
            where: { memberships: { some: { userId: users[0] } } },
            data: { lifecycle: 'ARCHIVED' },
        });
        clubId = (
            await api.prisma.club.create({ data: { id: randomUUID(), name: 'Progress Club' } })
        ).id;
        memberships = [];
        for (const [index, userId] of users.entries()) {
            memberships.push(
                (
                    await api.prisma.membership.create({
                        data: {
                            id: randomUUID(),
                            clubId,
                            userId,
                            role: index === 0 ? 'ADMIN' : 'MEMBER',
                        },
                    })
                ).id,
            );
        }
        sessionId = randomUUID();
        await api.prisma.session.create({
            data: {
                id: sessionId,
                clubId,
                type: 'FULL_CYCLE',
                phase: 'NOMINATION',
                ...(await snapshotSessionSettings(api.prisma, clubId)),
            },
        });
        await api.prisma.sessionParticipant.createMany({
            data: memberships
                .slice(0, 2)
                .map((membershipId) => ({ sessionId, clubId, membershipId, status: 'ACCEPTED' })),
        });
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
        await api.close();
    });
    const submit = (userId = users[0]) =>
        api.request(`/sessions/${sessionId}/nominations`, {
            userId,
            method: 'POST',
            json: { movieId },
        });
    const state = () => api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const events = () =>
        api.prisma.sessionProgressEvent.findMany({
            where: { sessionId },
            orderBy: { version: 'asc' },
        });
    const leave = (userId = users[1]) =>
        api.request(`/sessions/${sessionId}/leave`, {
            userId,
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
    it('should serialize concurrent final submissions and publish one automatic decision with repeated Movies', async () => {
        const results = await Promise.all([submit(), submit(users[1])]);
        expect(results.map((r) => r.status)).toEqual([201, 201]);
        expect(await state()).toMatchObject({
            phase: 'SELECTION',
            movieId: null,
            phaseVersion: 2,
            progressVersion: 3,
        });
        expect(await events()).toEqual([
            expect.objectContaining({ kind: 'PROGRESS', version: 2, nominatedCount: 1 }),
            expect.objectContaining({
                kind: 'AUTOMATIC',
                version: 3,
                phase: 'SELECTION',
                nominatedCount: 2,
                acceptedCount: 2,
                recipientIds: expect.arrayContaining(memberships.slice(0, 2)),
            }),
        ]);
        expect((await submit()).status).toBe(409);
        expect(await events()).toHaveLength(2);
    });
    it('should advance a sole accepted participant on submission', async () => {
        await api.prisma.sessionParticipant.updateMany({
            where: { sessionId, membershipId: memberships[1] },
            data: { status: 'INVITED' },
        });
        expect((await submit()).status).toBe(201);
        expect(await state()).toMatchObject({ phase: 'WATCHING', movieId, phaseVersion: 2 });
        expect(await events()).toEqual([
            expect.objectContaining({ kind: 'AUTOMATIC', acceptedCount: 1, nominatedCount: 1 }),
        ]);
    });
    it('should select the sole Movie when a non-nominator departs and keep zero accepted nominations open', async () => {
        await submit();
        expect((await leave()).status).toBe(204);
        expect(await state()).toMatchObject({ phase: 'WATCHING', movieId, phaseVersion: 2 });
        expect((await events()).at(-1)).toMatchObject({
            kind: 'AUTOMATIC',
            acceptedCount: 1,
            nominatedCount: 1,
        });
    });
    it('should keep Nomination open after everyone leaves without nominating', async () => {
        await leave();
        await leave(users[0]);
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        expect((await events()).at(-1)).toMatchObject({
            kind: 'PROGRESS',
            acceptedCount: 0,
            nominatedCount: 0,
        });
    });
    it('should complete after Club departure changes the denominator and preserve submission history', async () => {
        await submit();
        const response = await api.request(`/clubs/${clubId}/leave`, {
            userId: users[1],
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
        expect(response.status).toBe(204);
        expect(await state()).toMatchObject({ phase: 'WATCHING', movieId });
        expect(await api.prisma.nomination.count({ where: { sessionId } })).toBe(1);
    });
    it('should pause roster-triggered completion while archived and evaluate it on reactivation', async () => {
        await submit();
        expect(
            (
                await api.request(`/clubs/${clubId}/archive`, {
                    userId: users[0],
                    method: 'POST',
                    json: { confirmation: 'ARCHIVE' },
                })
            ).status,
        ).toBe(204);
        await leave();
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        expect(
            (await api.request(`/clubs/${clubId}/reactivate`, { userId: users[0], method: 'POST' }))
                .status,
        ).toBe(204);
        expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2, movieId });
    });
    it('should serialize the final submission against a departure using the committed roster', async () => {
        await submit();
        const [submission, departure] = await Promise.all([submit(users[1]), leave()]);
        expect(departure.status).toBe(204);
        expect([201, 409]).toContain(submission.status);
        expect(await state()).toMatchObject({
            phase: submission.status === 201 ? 'SELECTION' : 'WATCHING',
            phaseVersion: 2,
        });
        expect((await events()).filter((event) => event.kind === 'AUTOMATIC')).toHaveLength(1);
        expect((await events()).at(-1)).toMatchObject({ acceptedCount: 1, nominatedCount: 1 });
    });
    it('should evaluate completion after an operator removes the last non-nominator', async () => {
        await submit();
        const participant = await api.prisma.sessionParticipant.findFirstOrThrow({
            where: { sessionId, membershipId: memberships[1] },
        });
        expect(
            (
                await api.request(`/sessions/${sessionId}/participants/${participant.id}/remove`, {
                    userId: users[0],
                    method: 'POST',
                    json: { confirmation: 'REMOVE' },
                })
            ).status,
        ).toBe(204);
        expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2, movieId });
        expect((await events()).at(-1)).toMatchObject({
            kind: 'AUTOMATIC',
            acceptedCount: 1,
            nominatedCount: 1,
        });
    });
    it('should evaluate a retained nomination when its participant accepts a new invitation', async () => {
        await submit(users[1]);
        await leave();
        await leave(users[0]);
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        const invitation = await api.request(`/sessions/${sessionId}/invitations`, {
            userId: users[0],
            method: 'POST',
            json: { membershipId: memberships[1] },
        });
        const { id } = z.object({ id: z.uuid() }).parse(await invitation.json());
        expect(invitation.status).toBe(201);
        expect(
            (
                await api.request(`/session-invitations/${id}/respond`, {
                    userId: users[1],
                    method: 'POST',
                    json: { decision: 'accept' },
                })
            ).status,
        ).toBe(200);
        expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 2, movieId });
        expect((await events()).at(-1)).toMatchObject({
            kind: 'AUTOMATIC',
            acceptedCount: 1,
            nominatedCount: 1,
        });
        expect(await api.prisma.nomination.count({ where: { sessionId } })).toBe(1);
    });
    it('should atomically roll back the nomination and transition if the outbox write fails', async () => {
        await submit();
        // Reserve the next outbox key to force a real PostgreSQL uniqueness failure.
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
        expect((await submit(users[1])).status).toBe(500);
        expect(await state()).toMatchObject({
            phase: 'NOMINATION',
            phaseVersion: 1,
            progressVersion: 2,
        });
        expect(await api.prisma.nomination.count({ where: { sessionId } })).toBe(1);
        await api.prisma.sessionProgressEvent.delete({
            where: { sessionId_version: { sessionId, version: 3 } },
        });
        expect((await submit(users[1])).status).toBe(201);
        expect((await events()).filter((e) => e.kind === 'AUTOMATIC')).toHaveLength(1);
    });
    it('should serialize deadline execution against the final submission without a second transition', async () => {
        const deadlineAt = new Date(Date.now() + 60000);
        await api.prisma.session.update({ where: { id: sessionId }, data: { deadlineAt } });
        await submit();
        const worker = new NominationDeadlines(api.prisma, () => undefined);
        await Promise.all([
            submit(users[1]),
            worker.execute(sessionId, 1, new Date(deadlineAt.getTime() + 1)),
        ]);
        expect(await state()).toMatchObject({ phaseVersion: 2, deadlineAt: null });
        expect(
            (await events()).filter((e) => ['AUTOMATIC', 'DEADLINE'].includes(e.kind)),
        ).toHaveLength(1);
        expect(['HANDLED', 'STALE']).toContain(
            await worker.execute(sessionId, 1, new Date(deadlineAt.getTime() + 2)),
        );
    });
    it('should return current versions to two polling clients without nomination data', async () => {
        const poll = async () =>
            Promise.all(
                users.slice(0, 2).map(async (userId) => {
                    const response = await api.request(`/sessions/${sessionId}/progress`, {
                        userId,
                    });
                    expect(response.headers.get('cache-control')).toBe('private, no-store');
                    return response.json();
                }),
            );
        expect(await poll()).toEqual([{ version: 1 }, { version: 1 }]);
        await submit();
        expect(await poll()).toEqual([{ version: 2 }, { version: 2 }]);
    });
    it('should deny private progress on every poll after membership access is lost', async () => {
        expect((await api.request(`/sessions/${sessionId}/progress`)).status).toBe(401);
        const outsider = await createUser(api.prisma);
        users.push(outsider);
        expect(
            (await api.request(`/sessions/${sessionId}/progress`, { userId: outsider })).status,
        ).toBe(404);
        expect(
            (await api.request(`/sessions/${sessionId}/progress`, { userId: users[1] })).status,
        ).toBe(200);
        await api.prisma.membership.update({
            where: { id: memberships[1] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        expect(
            (await api.request(`/sessions/${sessionId}/progress`, { userId: users[1] })).status,
        ).toBe(404);
    });
});
