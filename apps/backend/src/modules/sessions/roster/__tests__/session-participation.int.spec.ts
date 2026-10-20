import { randomUUID } from 'node:crypto';

import {
    type IPendingSessionInvitation,
    type ISessionRoster,
    sessionSchema,
} from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../../testing/integration.js';

describe('Session participation', () => {
    let api: ITestApi;
    let users: string[];
    let member: string;
    let outsider: string;
    let clubId: string;
    let sessionId: string;
    let membershipId: string;
    let movieIds: string[];

    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        movieIds = [];
        users = await Promise.all(Array.from({ length: 3 }, () => createUser(api.prisma)));
        const admin = users[0]!;
        member = users[1]!;
        outsider = users[2]!;
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Shared Session Club' } });
        await addMember(api.prisma, clubId, admin, 'ADMIN');
        membershipId = await addMember(api.prisma, clubId, member);
        sessionId = (
            await createSession(api.prisma, clubId, { type: 'FULL_CYCLE', phase: 'NOMINATION' })
        ).id;
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
    });
    afterAll(async () => {
        await api.close();
    });
    const participate = (userId = member, decision = 'accept') =>
        api.request(`/sessions/${sessionId}/participation`, {
            userId,
            method: 'POST',
            json: { decision },
        });
    const pending = async (userId = member) =>
        (await (
            await api.request('/session-invitations/pending', { userId })
        ).json()) as IPendingSessionInvitation[];
    const roster = async () =>
        (await (
            await api.request(`/sessions/${sessionId}/roster`, { userId: member })
        ).json()) as ISessionRoster;

    it('should offer every member an open Session and join once under concurrent requests', async () => {
        expect(await pending()).toEqual([
            expect.objectContaining({ id: sessionId, expiresAt: null }),
        ]);
        expect(await pending(outsider)).toEqual([]);
        expect((await roster()).canJoin).toBe(true);
        const membershipCount = await api.prisma.membership.count();
        const responses = await Promise.all([participate(), participate()]);
        expect(responses.map((response) => response.status)).toEqual([200, 200]);
        expect(
            await api.prisma.sessionParticipant.count({ where: { sessionId, status: 'ACCEPTED' } }),
        ).toBe(1);
        expect(await api.prisma.membership.count()).toBe(membershipCount);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_INVITE_RESPONDED' },
            }),
        ).toBe(1);
        expect(await pending()).toEqual([]);
        expect((await roster()).canJoin).toBe(false);
    });

    it('should allow joining in every open phase without reopening a completed phase', async () => {
        for (const phase of ['NOMINATION', 'SELECTION', 'WATCHING', 'RATING'] as const) {
            await api.prisma.session.update({ where: { id: sessionId }, data: { phase } });
            await api.prisma.sessionParticipant.deleteMany({ where: { sessionId } });
            expect((await pending()).map((row) => row.id)).toEqual([sessionId]);
            expect((await participate()).status).toBe(200);
            expect(
                (await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } })).phase,
            ).toBe(phase);
        }
        for (const phase of ['COMPLETED', 'CANCELLED'] as const) {
            await api.prisma.session.update({ where: { id: sessionId }, data: { phase } });
            expect(await pending()).toEqual([]);
            expect((await participate()).status).toBe(409);
            expect((await roster()).canJoin).toBe(false);
        }
    });

    it('should let a late member score the frozen films and keep the winner after a Watching join', async () => {
        const otherMembership = await addMember(api.prisma, clubId, outsider);
        const adminMembership = await api.prisma.membership.findFirstOrThrow({
            where: { clubId, userId: users[0]! },
        });
        const nominationIds: string[] = [];
        for (const membership of [adminMembership.id, otherMembership]) {
            const participant = await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId: membership, status: 'ACCEPTED' },
            });
            const movie = await api.prisma.movie.create({
                data: { title: 'Late participation film' },
            });
            movieIds.push(movie.id);
            nominationIds.push(
                (
                    await api.prisma.nomination.create({
                        data: { sessionId, participantId: participant.id, movieId: movie.id },
                    })
                ).id,
            );
        }
        await api.prisma.session.update({ where: { id: sessionId }, data: { phase: 'SELECTION' } });
        const submit = (userId: string) =>
            api.request(`/sessions/${sessionId}/selection`, {
                userId,
                method: 'POST',
                json: { scores: nominationIds.map((nominationId) => ({ nominationId, score: 1 })) },
            });
        expect((await submit(users[0]!)).status).toBe(201);
        expect((await participate()).status).toBe(200);
        const detail = sessionSchema.parse(
            await (await api.request(`/sessions/${sessionId}`, { userId: member })).json(),
        );
        expect(
            detail.selection?.nominations
                .map((row) => row.id)
                .toSorted((a, b) => a.localeCompare(b)),
        ).toEqual([...nominationIds].toSorted((a, b) => a.localeCompare(b)));
        expect(detail.selection?.canSubmit).toBe(true);
        expect((await submit(outsider)).status).toBe(201);
        expect(
            (await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } })).phase,
        ).toBe('SELECTION');
        expect((await submit(member)).status).toBe(201);
        const saved = await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
        expect(saved.phase).toBe('WATCHING');
        const lateUser = await createUser(api.prisma);
        users.push(lateUser);
        await addMember(api.prisma, clubId, lateUser);
        expect((await participate(lateUser)).status).toBe(200);
        const afterJoin = await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
        expect(afterJoin.movieId).toBe(saved.movieId);
        expect(afterJoin.selectionResult).toEqual(saved.selectionResult);
    });

    it('should offer an unanswered Session again after the user rejoins the Club with a new Membership', async () => {
        expect((await participate(member, 'decline')).status).toBe(200);
        expect(await pending()).toEqual([]);
        await api.prisma.membership.update({
            where: { id: membershipId },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const newMembershipId = await addMember(api.prisma, clubId, member);
        expect((await pending()).map((row) => row.id)).toEqual([sessionId]);
        expect((await roster()).canJoin).toBe(true);
        expect((await participate()).status).toBe(200);
        expect(
            await api.prisma.sessionParticipant.findUnique({
                where: { sessionId_membershipId: { sessionId, membershipId } },
            }),
        ).toMatchObject({ status: 'DECLINED' });
        expect(
            await api.prisma.sessionParticipant.findUnique({
                where: { sessionId_membershipId: { sessionId, membershipId: newMembershipId } },
            }),
        ).toMatchObject({ status: 'ACCEPTED' });
    });

    it('should record decline, allow reconsideration and require typed leave after acceptance', async () => {
        expect((await participate(member, 'decline')).status).toBe(200);
        expect(await pending()).toEqual([]);
        expect((await roster()).canJoin).toBe(true);
        expect((await participate()).status).toBe(200);
        expect(await (await participate(member, 'decline')).json()).toMatchObject({
            state: 'accepted',
        });
        expect((await roster()).canLeave).toBe(true);
    });

    it('should enforce membership, Club lifecycle, input and operator removal', async () => {
        expect((await participate(outsider)).status).toBe(404);
        expect(
            (
                await api.request(`/sessions/${sessionId}/participation`, {
                    method: 'POST',
                    json: { decision: 'accept' },
                })
            ).status,
        ).toBe(401);
        expect((await participate(member, 'invalid')).status).toBe(400);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await participate()).status).toBe(409);
        expect(await pending()).toEqual([]);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await api.prisma.sessionParticipant.create({
            data: { sessionId, clubId, membershipId, status: 'REMOVED' },
        });
        expect((await participate()).status).toBe(409);
        expect((await roster()).canJoin).toBe(false);
        expect(await pending()).toEqual([]);
    });
});
