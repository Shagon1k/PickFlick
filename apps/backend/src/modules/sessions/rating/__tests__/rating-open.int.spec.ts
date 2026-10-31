import { randomUUID } from 'node:crypto';

import type { IClubHub, TSession } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';

describe('Watching', () => {
    let api: ITestApi;
    let users: string[];
    let clubId: string;
    let sessionId: string;
    let movieId: string;
    beforeAll(async () => {
        api = await startTestApi();
        users = await Promise.all(Array.from({ length: 4 }, () => createUser(api.prisma)));
        movieId = (await api.prisma.movie.create({ data: { title: 'Screening film' } })).id;
    });
    beforeEach(async () => {
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Watching Club' } });
        const memberships = [];
        for (const [index, role] of (['ADMIN', 'MODERATOR', 'MEMBER'] as const).entries()) {
            memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
        }
        const session = await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'WATCHING',
            movieId,
            topic: 'Screening night',
            location: 'Room A',
            scheduledAt: new Date('2026-12-01T20:00:00Z'),
        });
        sessionId = session.id;
        await api.prisma.sessionParticipant.create({
            data: { sessionId, clubId, membershipId: memberships[2]!, status: 'ACCEPTED' },
        });
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
        await api.close();
    });
    const state = () => api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const open = (userId = users[0], input = {}) =>
        api.request(`/sessions/${sessionId}/rating/open`, {
            method: 'POST',
            userId,
            json: { confirmation: 'OPEN', phaseVersion: 1, ...input },
        });
    const createNext = () =>
        api.request(`/clubs/${clubId}/sessions`, {
            method: 'POST',
            userId: users[0],
            json: {
                type: 'FULL_CYCLE',
                movieId: null,
                location: 'Room B',
                scheduledAt: '2090-12-02T20:00:00Z',
                deadlineAt: null,
            },
        });

    it('should leave Watching unchanged on detail, roster, progress and participation requests', async () => {
        for (const path of ['', '/roster', '/progress']) {
            await api.expectStatus(200, `/sessions/${sessionId}${path}`, { userId: users[2] });
        }
        const join = await api.request(`/sessions/${sessionId}/participation`, {
            userId: users[1],
            method: 'POST',
            json: { decision: 'accept' },
        });
        expect(join.status).toBe(200);
        expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 1 });
        expect((await createNext()).status).toBe(409);
    });

    it('should open Rating once under concurrent operators and retries, preserving the screening', async () => {
        const before = await state();
        const participants = await api.prisma.sessionParticipant.findMany({ where: { sessionId } });
        const results = await Promise.all([open(), open(users[1]), open()]);
        expect(results.map((response) => response.status)).toEqual([201, 201, 201]);
        expect(results[0].headers.get('cache-control')).toBe('private, no-store');
        const saved = await state();
        expect(saved).toMatchObject({
            phase: 'RATING',
            phaseVersion: 2,
            detailsVersion: 2,
            progressVersion: 2,
            movieId: before.movieId,
            topic: before.topic,
            location: before.location,
            scheduledAt: before.scheduledAt,
            selectionResult: before.selectionResult,
        });
        expect(await api.prisma.sessionParticipant.findMany({ where: { sessionId } })).toEqual(
            participants,
        );
        expect((await open(users[1])).status).toBe(201);
        expect(await state()).toEqual(saved);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_RATING_OPENED' },
            }),
        ).toBe(1);
        expect(
            await api.prisma.sessionProgressEvent.findMany({ where: { sessionId } }),
        ).toMatchObject([{ kind: 'MANUAL', phase: 'RATING', phaseVersion: 2, version: 2 }]);
        const next = await createNext();
        expect(next.status).toBe(201);
        const nextSession = (await next.json()) as TSession;
        const hub = (await (
            await api.request(`/clubs/${clubId}/hub`, { userId: users[2] })
        ).json()) as IClubHub;
        expect(hub.activeSession?.id).toBe(nextSession.id);
        expect(hub.ratingSessions.map((session) => session.id)).toContain(sessionId);
    });

    it('should enforce authorization even for retries after Rating opens', async () => {
        expect(
            (
                await api.request(`/sessions/${sessionId}/rating/open`, {
                    method: 'POST',
                    json: { confirmation: 'OPEN', phaseVersion: 1 },
                })
            ).status,
        ).toBe(401);
        expect((await open(users[2])).status).toBe(403);
        expect((await open(users[3])).status).toBe(404);
        expect((await open()).status).toBe(201);
        expect((await open(users[2])).status).toBe(403);
        await api.prisma.membership.updateMany({
            where: { clubId, userId: users[1] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        expect((await open(users[1])).status).toBe(404);
        expect(await state()).toMatchObject({ phase: 'RATING', phaseVersion: 2 });
    });

    it.each(['archived', 'adminless', 'over-limit'])(
        'should reject operators in a %s Club',
        async (restriction) => {
            if (restriction === 'archived')
                await api.prisma.club.update({
                    where: { id: clubId },
                    data: { lifecycle: 'ARCHIVED' },
                });
            if (restriction === 'adminless')
                await api.prisma.membership.updateMany({
                    where: { clubId, role: 'ADMIN' },
                    data: { status: 'LEFT', leftAt: new Date() },
                });
            if (restriction === 'over-limit') {
                for (let index = 0; index < 6; index++) {
                    const userId = await createUser(api.prisma);
                    users.push(userId);
                    await addMember(api.prisma, clubId, userId);
                }
            }
            const result = await open(users[1]);
            expect(result.status).toBe(409);
            expect(await result.json()).toMatchObject({ error: { reason: 'CLUB_READ_ONLY' } });
            expect(await state()).toMatchObject({ phase: 'WATCHING', phaseVersion: 1 });
        },
    );

    it('should reject invalid confirmations, stale versions and other phases', async () => {
        expect((await open(users[0], { confirmation: 'CLOSE' })).status).toBe(400);
        expect((await open(users[0], { phaseVersion: 0 })).status).toBe(400);
        expect((await open(users[0], { extra: true })).status).toBe(400);
        expect((await open(users[0], { phaseVersion: 2 })).status).toBe(409);
        for (const phase of ['NOMINATION', 'SELECTION', 'COMPLETED', 'CANCELLED'] as const) {
            await api.prisma.session.update({ where: { id: sessionId }, data: { phase } });
            expect((await open()).status).toBe(409);
        }
        expect(await api.prisma.clubAuditEvent.count({ where: { sessionId } })).toBe(0);
    });

    it('should roll back the phase and retain the slot when progress publication fails', async () => {
        await api.prisma.sessionProgressEvent.create({
            data: {
                sessionId,
                version: 2,
                kind: 'PROGRESS',
                phase: 'WATCHING',
                phaseVersion: 1,
                detailsVersion: 1,
                acceptedCount: 1,
                nominatedCount: 0,
                recipientIds: [],
            },
        });
        expect((await open()).status).toBe(500);
        expect(await state()).toMatchObject({
            phase: 'WATCHING',
            phaseVersion: 1,
            detailsVersion: 1,
            progressVersion: 1,
        });
        expect(await api.prisma.clubAuditEvent.count({ where: { sessionId } })).toBe(0);
        expect((await createNext()).status).toBe(409);
        await api.prisma.sessionProgressEvent.delete({
            where: { sessionId_version: { sessionId, version: 2 } },
        });
        expect((await open()).status).toBe(201);
        expect((await createNext()).status).toBe(201);
    });
});
