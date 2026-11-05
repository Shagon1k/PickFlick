import { randomUUID } from 'node:crypto';

import { sessionSchema } from '@pickflick/contracts';

import {
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';
import { NominationDeadlines } from '../nominations/nomination-deadlines.js';

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
        await createSession(api.prisma, clubId, {
            id: sessionId,
            type: 'FULL_CYCLE',
            phase: 'NOMINATION',
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
    const joinThird = () =>
        api.prisma.sessionParticipant.create({
            data: { sessionId, clubId, membershipId: memberships[2]!, status: 'ACCEPTED' },
        });
    const leave = (userId = users[1]) =>
        api.request(`/sessions/${sessionId}/leave`, {
            userId,
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
    const excludeUnjoinedMember = () =>
        api.prisma.membership.update({
            where: { id: memberships[2] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
    it('should serialize concurrent final submissions and publish one automatic decision with repeated Movies', async () => {
        await excludeUnjoinedMember();
        const results = await Promise.all([submit(), submit(users[1])]);
        expect(results.map((result) => result.status)).toEqual([201, 201]);
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
    it('should wait for an unjoined Club member and advance only after that member joins and nominates', async () => {
        await submit();
        await submit(users[1]);
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        const response = await api.request(`/sessions/${sessionId}`, { userId: users[0] });
        expect(sessionSchema.parse(await response.json()).nominations).toMatchObject({
            memberCount: 3,
            acceptedCount: 2,
            nominatedCount: 2,
        });
        await api.expectStatus(200, `/sessions/${sessionId}/participation`, {
            userId: users[2],
            method: 'POST',
            json: { decision: 'accept' },
        });
        expect(await state()).toMatchObject({ phase: 'NOMINATION' });
        await submit(users[2]);
        expect(await state()).toMatchObject({ phase: 'SELECTION', phaseVersion: 2 });
        expect((await events()).filter((event) => event.kind === 'AUTOMATIC')).toHaveLength(1);
    });
    it('should reevaluate Nomination when an unjoined member leaves the Club', async () => {
        await submit();
        await submit(users[1]);
        await api.expectStatus(204, `/clubs/${clubId}/leave`, {
            userId: users[2],
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
        expect(await state()).toMatchObject({ phase: 'SELECTION', phaseVersion: 2 });
    });
    it('should reevaluate Nomination when the Admin removes an unjoined Club member', async () => {
        await submit();
        await submit(users[1]);
        await api.expectStatus(204, `/clubs/${clubId}/members/${memberships[2]}/remove`, {
            userId: users[0],
            method: 'POST',
            json: { confirmation: 'REMOVE' },
        });
        expect(await state()).toMatchObject({ phase: 'SELECTION', phaseVersion: 2 });
    });
    it('should keep the nomination of a sole participant open until someone else joins', async () => {
        await api.prisma.sessionParticipant.updateMany({
            where: { sessionId, membershipId: memberships[1] },
            data: { status: 'INVITED' },
        });
        expect((await submit()).status).toBe(201);
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        expect(await events()).toEqual([
            expect.objectContaining({ kind: 'PROGRESS', acceptedCount: 1, nominatedCount: 1 }),
        ]);
    });
    it('should keep Nomination open when a non-nominator leaves only the Session', async () => {
        await submit();
        await joinThird();
        await submit(users[2]);
        expect((await leave()).status).toBe(204);
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        expect((await events()).at(-1)).toMatchObject({
            kind: 'PROGRESS',
            acceptedCount: 2,
            nominatedCount: 2,
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
        await joinThird();
        await submit(users[2]);
        const response = await api.request(`/clubs/${clubId}/leave`, {
            userId: users[1],
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
        expect(response.status).toBe(204);
        expect(await state()).toMatchObject({ phase: 'SELECTION' });
        expect(await api.prisma.nomination.count({ where: { sessionId } })).toBe(2);
    });
    it('should pause roster-triggered completion while archived and evaluate it on reactivation', async () => {
        await submit();
        await joinThird();
        await submit(users[2]);
        await api.expectStatus(204, `/clubs/${clubId}/archive`, {
            userId: users[0],
            method: 'POST',
            json: { confirmation: 'ARCHIVE' },
        });
        await leave();
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        await api.expectStatus(204, `/clubs/${clubId}/reactivate`, {
            userId: users[0],
            method: 'POST',
        });
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        await api.expectStatus(200, `/sessions/${sessionId}/participation`, {
            userId: users[1],
            method: 'POST',
            json: { decision: 'accept' },
        });
        await submit(users[1]);
        expect(await state()).toMatchObject({ phase: 'SELECTION', phaseVersion: 2 });
    });
    it('should serialize the final submission against a departure using the committed roster', async () => {
        await submit();
        const [submission, departure] = await Promise.all([submit(users[1]), leave()]);
        expect(departure.status).toBe(204);
        expect([201, 403]).toContain(submission.status);
        expect(await state()).toMatchObject({
            phase: 'NOMINATION',
            phaseVersion: 1,
        });
        expect((await events()).filter((event) => event.kind === 'AUTOMATIC')).toHaveLength(0);
        expect((await events()).at(-1)).toMatchObject({ acceptedCount: 1, nominatedCount: 1 });
    });
    it('should wait for the Club roster after an operator removes a Session participant', async () => {
        await submit();
        await joinThird();
        await submit(users[2]);
        const participant = await api.prisma.sessionParticipant.findFirstOrThrow({
            where: { sessionId, membershipId: memberships[1] },
        });
        await api.expectStatus(
            204,
            `/sessions/${sessionId}/participants/${participant.id}/remove`,
            {
                userId: users[0],
                method: 'POST',
                json: { confirmation: 'REMOVE' },
            },
        );
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        expect((await events()).at(-1)).toMatchObject({
            kind: 'PROGRESS',
            acceptedCount: 2,
            nominatedCount: 2,
        });
    });
    it('should keep a retained nomination open when its participant returns alone', async () => {
        await submit(users[1]);
        await leave();
        await leave(users[0]);
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        const rejoined = await api.request(`/sessions/${sessionId}/participation`, {
            userId: users[1],
            method: 'POST',
            json: { decision: 'accept' },
        });
        expect(rejoined.status).toBe(200);
        expect(await state()).toMatchObject({ phase: 'NOMINATION', phaseVersion: 1 });
        expect((await events()).at(-1)).toMatchObject({
            kind: 'PROGRESS',
            acceptedCount: 1,
            nominatedCount: 1,
        });
        expect(await api.prisma.nomination.count({ where: { sessionId } })).toBe(1);
    });
    it('should atomically roll back the nomination and transition if the outbox write fails', async () => {
        await excludeUnjoinedMember();
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
        expect((await events()).filter((event) => event.kind === 'AUTOMATIC')).toHaveLength(1);
    });
    it('should serialize deadline execution against the final submission without a second transition', async () => {
        const deadlineAt = new Date(Date.now() + 60000);
        await api.prisma.session.update({ where: { id: sessionId }, data: { deadlineAt } });
        await submit();
        const worker = new NominationDeadlines(api.prisma, () => undefined, api.transactions);
        await Promise.all([
            submit(users[1]),
            worker.execute(sessionId, new Date(deadlineAt.getTime() + 1)),
        ]);
        expect(await state()).toMatchObject({ phaseVersion: 2, deadlineAt: null });
        expect(
            (await events()).filter((event) => ['AUTOMATIC', 'DEADLINE'].includes(event.kind)),
        ).toHaveLength(1);
        expect(await worker.execute(sessionId, new Date(deadlineAt.getTime() + 2))).toBe('STALE');
    });
    it('should report the progress version only to current Club members', async () => {
        await api.expectStatus(401, `/sessions/${sessionId}/progress`);
        const outsider = await createUser(api.prisma);
        users.push(outsider);
        await api.expectStatus(404, `/sessions/${sessionId}/progress`, { userId: outsider });
        const progress = async () =>
            (await api.request(`/sessions/${sessionId}/progress`, { userId: users[1] })).json();
        expect(await progress()).toEqual({ version: 1 });
        await submit();
        expect(await progress()).toEqual({ version: 2 });
        await api.prisma.membership.update({
            where: { id: memberships[1] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        await api.expectStatus(404, `/sessions/${sessionId}/progress`, { userId: users[1] });
    });
    it('should let a group polling from one address stay above the default rate limit', async () => {
        const statuses = [];
        for (let request = 0; request < 130; request += 1) {
            statuses.push(
                (await api.request(`/sessions/${sessionId}/progress`, { userId: users[0] })).status,
            );
        }
        expect(statuses.every((status) => status === 200)).toBe(true);
    });
});
