import { randomUUID } from 'node:crypto';

import { type IClubHub, sessionSchema, type TSession } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../../testing/integration.js';

describe('Past Sessions', () => {
    let api: ITestApi;
    let users: string[];
    let memberships: string[];
    let clubId: string;
    let movieId: string;
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 5 }, () => createUser(api.prisma)));
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Historical Club' } });
        movieId = (await api.prisma.movie.create({ data: { title: 'Repeat screening' } })).id;
        memberships = [];
        for (const [index, role] of (['ADMIN', 'MODERATOR', 'MEMBER', 'MEMBER'] as const).entries())
            memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
    });
    afterAll(async () => {
        await api.close();
    });
    const create = (input = {}, userId = users[0]) =>
        api.request(`/clubs/${clubId}/sessions/past`, {
            userId,
            method: 'POST',
            json: {
                scheduledAt: '2020-01-01T00:00:00Z',
                location: 'Old cinema',
                movieId,
                attendees: [],
                ...input,
            },
        });
    async function read(response: Response): Promise<TSession> {
        expect(response.status).toBe(201);
        return sessionSchema.parse(await response.json());
    }
    it('should store a minimal Completed record without fabricating phases, roster or submissions', async () => {
        const session = await read(await create());
        expect(session).toMatchObject({
            type: 'PAST',
            phase: 'COMPLETED',
            deadlineAt: null,
            selection: null,
            selectionOutcome: null,
            nominations: null,
            canEdit: false,
            canCancel: false,
        });
        expect(session.rating).toMatchObject({
            acceptedCount: 0,
            receivedCount: 0,
            results: { average: null, entries: [] },
        });
        expect(await api.prisma.nomination.count({ where: { sessionId: session.id } })).toBe(0);
        expect(await api.prisma.selectionBallot.count({ where: { sessionId: session.id } })).toBe(
            0,
        );
        expect(
            await api.prisma.sessionParticipant.count({ where: { sessionId: session.id } }),
        ).toBe(0);
        expect(await api.prisma.sessionRating.count({ where: { sessionId: session.id } })).toBe(0);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId: session.id, action: 'SESSION_CREATED' },
            }),
        ).toBe(1);
        const hub = (await (
            await api.request(`/clubs/${clubId}/hub`, { userId: users[0] })
        ).json()) as IClubHub;
        expect(hub.historySessions).toEqual([
            expect.objectContaining({ id: session.id, ratingAverage: null }),
        ]);
        expect(hub.activeSession).toBeUndefined();
    });
    it('should accept former attendees and partial imported ratings without creating live timestamps', async () => {
        await api.prisma.membership.update({
            where: { id: memberships[2] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        await api.prisma.membership.update({
            where: { id: memberships[3] },
            data: { status: 'REMOVED', leftAt: new Date() },
        });
        const members = await api.request(`/clubs/${clubId}/sessions/past/members`, {
            userId: users[1],
        });
        expect(await members.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: memberships[2], status: 'LEFT' }),
                expect.objectContaining({ id: memberships[3], status: 'REMOVED' }),
            ]),
        );
        const session = await read(
            await create(
                {
                    topic: 'Old favourites',
                    notes: 'Only one score survived.',
                    attendees: [
                        { membershipId: memberships[2], score: 9 },
                        { membershipId: memberships[3] },
                    ],
                },
                users[1],
            ),
        );
        expect(session.rating).toMatchObject({
            acceptedCount: 2,
            receivedCount: 1,
            results: {
                average: 9,
                entries: [expect.objectContaining({ score: 9, submittedAt: null })],
            },
        });
        const participants = await api.prisma.sessionParticipant.findMany({
            where: { sessionId: session.id },
        });
        expect(participants).toHaveLength(2);
        expect(participants.every((row) => row.attended && row.status === 'ACCEPTED')).toBe(true);
        expect((await api.request(`/sessions/${session.id}`, { userId: users[2] })).status).toBe(
            404,
        );
        const rating = await api.prisma.sessionRating.findFirstOrThrow({
            where: { sessionId: session.id },
        });
        expect(rating.submittedAt).toBeNull();
        await expect(
            api.prisma.sessionRating.update({ where: { id: rating.id }, data: { score: 1 } }),
        ).rejects.toThrow('immutable');
        expect(
            (
                await api.request(`/sessions/${session.id}/rating`, {
                    userId: users[0],
                    method: 'POST',
                    json: { score: 1 },
                })
            ).status,
        ).toBe(403);
    });
    it('should preserve repeat viewings of one Movie alongside a blocking Session', async () => {
        await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'WATCHING',
            movieId,
        });
        const first = await read(await create());
        const second = await read(await create({ scheduledAt: '2021-01-01T00:00:00Z' }));
        expect(first.id).not.toBe(second.id);
        expect(await api.prisma.movie.count({ where: { id: movieId } })).toBe(1);
        expect(await api.prisma.session.count({ where: { clubId, movieId } })).toBe(3);
    });
    it('should list a rejoined person once and reject duplicate attendance across Memberships', async () => {
        await api.prisma.membership.update({
            where: { id: memberships[2] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const current = await addMember(api.prisma, clubId, users[2]!);
        const members: unknown = await (
            await api.request(`/clubs/${clubId}/sessions/past/members`, { userId: users[0] })
        ).json();
        expect(members).toEqual(expect.arrayContaining([expect.objectContaining({ id: current })]));
        expect(members).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: memberships[2] })]),
        );
        const response = await create({
            attendees: [{ membershipId: memberships[2] }, { membershipId: current }],
        });
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: { reason: 'ATTENDEE_DUPLICATE' } });
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(0);
    });
    it('should reject malformed evidence and foreign attendees atomically', async () => {
        const otherClubId = randomUUID();
        await api.prisma.club.create({ data: { id: otherClubId, name: 'Other Club' } });
        const foreign = await addMember(api.prisma, otherClubId, users[4]!, 'ADMIN');
        for (const input of [
            { attendees: [{ membershipId: memberships[0] }, { membershipId: memberships[0] }] },
            { attendees: [{ membershipId: memberships[0], score: 0 }] },
            { attendees: [{ membershipId: memberships[0], score: 11 }] },
            { scheduledAt: '2999-01-01T00:00:00Z' },
            { deadlineAt: '2020-01-01T00:00:00Z' },
        ])
            expect((await create(input)).status).toBe(400);
        expect(
            (
                await create({
                    attendees: [
                        { membershipId: memberships[0], score: 8 },
                        { membershipId: foreign },
                    ],
                })
            ).status,
        ).toBe(409);
        expect((await create({ movieId: randomUUID() })).status).toBe(409);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(0);
        expect(await api.prisma.clubAuditEvent.count({ where: { clubId } })).toBe(0);
    });
    it('should enforce authentication, Club membership, operator role and writable lifecycle for both endpoints', async () => {
        for (const [userId, status] of [
            [users[4], 404],
            [users[2], 403],
        ] as const) {
            expect((await create({}, userId)).status).toBe(status);
            expect(
                (await api.request(`/clubs/${clubId}/sessions/past/members`, { userId })).status,
            ).toBe(status);
        }
        expect(
            (await api.request(`/clubs/${clubId}/sessions/past`, { method: 'POST', json: {} }))
                .status,
        ).toBe(401);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await create()).status).toBe(409);
        expect(
            (await api.request(`/clubs/${clubId}/sessions/past/members`, { userId: users[0] }))
                .status,
        ).toBe(409);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await api.prisma.membership.update({
            where: { id: memberships[0] },
            data: { role: 'MEMBER' },
        });
        expect((await create({}, users[1])).status).toBe(409);
    });
    it('should retain saved visibility and attendee attribution when Club settings and accounts change', async () => {
        await api.prisma.club.update({ where: { id: clubId }, data: { showRatingResults: false } });
        const session = await read(
            await create({ attendees: [{ membershipId: memberships[2], score: 6 }] }),
        );
        await api.prisma.club.update({ where: { id: clubId }, data: { showRatingResults: true } });
        const hidden = sessionSchema.parse(
            await (await api.request(`/sessions/${session.id}`, { userId: users[3] })).json(),
        );
        expect(hidden.rating?.results).toBeNull();
        await api.prisma.user.update({
            where: { id: users[2] },
            data: { displayName: 'Deleted user', status: 'ANONYMIZED' },
        });
        const detail = sessionSchema.parse(
            await (await api.request(`/sessions/${session.id}`, { userId: users[0] })).json(),
        );
        expect(detail.rating?.results?.entries).toEqual([
            expect.objectContaining({ author: 'Deleted user', score: 6 }),
        ]);
    });
    it('should enforce imported provenance and preserve live-rating database guards', async () => {
        const session = await read(
            await create({
                attendees: [{ membershipId: memberships[0] }, { membershipId: memberships[1] }],
            }),
        );
        const participants = await api.prisma.sessionParticipant.findMany({
            where: { sessionId: session.id },
            orderBy: { membershipId: 'asc' },
        });
        await expect(
            api.prisma.sessionRating.create({
                data: { sessionId: session.id, participantId: participants[0]!.id, score: 5 },
            }),
        ).rejects.toThrow('no submission time');
        const live = await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'RATING',
        });
        const participant = await api.prisma.sessionParticipant.create({
            data: { clubId, sessionId: live.id, membershipId: memberships[0]!, status: 'ACCEPTED' },
        });
        await expect(
            api.prisma.sessionRating.create({
                data: {
                    sessionId: live.id,
                    participantId: participant.id,
                    score: 5,
                    submittedAt: null,
                },
            }),
        ).rejects.toThrow('submission time');
        await expect(
            api.prisma.sessionRating.create({
                data: { sessionId: live.id, participantId: participants[1]!.id, score: 5 },
            }),
        ).rejects.toThrow();
    });
});
