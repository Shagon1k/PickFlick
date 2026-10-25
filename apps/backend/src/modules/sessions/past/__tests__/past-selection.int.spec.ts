import { randomUUID } from 'node:crypto';

import { sessionSchema, type TCreatePastSession } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../../testing/integration.js';
import * as tiers from '../../../clubs/access/club-tiers.js';

describe('Past Selection evidence', () => {
    let api: ITestApi;
    let users: string[];
    let memberships: string[];
    let clubId: string;
    let movieIds: string[];
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 3 }, () => createUser(api.prisma)));
        clubId = randomUUID();
        await api.prisma.club.create({
            data: {
                id: clubId,
                name: 'Partial history',
                selectionScaleMin: 0,
                selectionScaleMax: 5,
                showVoteResults: true,
            },
        });
        memberships = [];
        for (const [index, role] of (['ADMIN', 'MEMBER', 'MODERATOR'] as const).entries())
            memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
        movieIds = await Promise.all(
            ['Screened film', 'Remembered rival', 'Unknown scores'].map(
                async (title) => (await api.prisma.movie.create({ data: { title } })).id,
            ),
        );
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        await removeUsers(api.prisma, users);
        await api.prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
    });
    afterAll(async () => {
        await api.close();
    });

    function buildInput(): TCreatePastSession {
        return {
            submissionId: randomUUID(),
            scheduledAt: '2020-01-01T00:00:00Z',
            location: 'Old cinema',
            movieId: movieIds[0]!,
            attendees: memberships.map((membershipId) => ({ membershipId })),
            nominations: movieIds.map((movieId) => ({ movieId })),
            scoreMatrix: [
                {
                    membershipId: memberships[0]!,
                    scores: [
                        { movieId: movieIds[0]!, score: 0 },
                        { movieId: movieIds[1]!, score: 5 },
                    ],
                },
                { membershipId: memberships[1]!, scores: [{ movieId: movieIds[1]!, score: 3 }] },
            ],
        };
    }
    const create = (input: unknown, userId = users[0]) =>
        api.request(`/clubs/${clubId}/sessions/past`, { userId, method: 'POST', json: input });
    const get = async (id: string, userId = users[0]) => {
        const session = sessionSchema.parse(
            await (await api.request(`/sessions/${id}`, { userId })).json(),
        );
        if (session.selectionOutcome?.source !== 'IMPORTED')
            throw new Error('Expected imported outcome');
        return { ...session, selectionOutcome: session.selectionOutcome };
    };

    it('should store only supplied partial evidence without live ballots, authors, times or recomputed winners', async () => {
        const input = buildInput();
        expect((await create(input)).status).toBe(201);
        const session = await get(input.submissionId);
        expect(session.movieId).toBe(movieIds[0]);
        expect(session.selectionOutcome).toMatchObject({
            source: 'IMPORTED',
            scaleMin: 0,
            scaleMax: 5,
            nominations: expect.arrayContaining([
                {
                    movie: expect.objectContaining({ id: movieIds[0] }),
                    author: null,
                    total: 0,
                    scoreCount: 1,
                },
                {
                    movie: expect.objectContaining({ id: movieIds[1] }),
                    author: null,
                    total: 8,
                    scoreCount: 2,
                },
                {
                    movie: expect.objectContaining({ id: movieIds[2] }),
                    author: null,
                    total: null,
                    scoreCount: 0,
                },
            ]),
        });
        expect(
            await api.prisma.pastSelectionScore.count({ where: { sessionId: session.id } }),
        ).toBe(3);
        expect(await api.prisma.selectionBallot.count({ where: { sessionId: session.id } })).toBe(
            0,
        );
        expect(await api.prisma.nomination.count({ where: { sessionId: session.id } })).toBe(0);
        expect(await api.prisma.sessionRating.count({ where: { sessionId: session.id } })).toBe(0);
    });
    it('should accept a nomination list independently of attendance, ratings or the screened Movie', async () => {
        const input = {
            ...buildInput(),
            attendees: [],
            nominations: [{ movieId: movieIds[1] }],
            scoreMatrix: [],
        };
        expect((await create(input)).status).toBe(201);
        const session = await get(input.submissionId);
        expect(session.selectionOutcome?.nominations).toEqual([
            {
                movie: expect.objectContaining({ id: movieIds[1] }),
                author: null,
                scoreCount: 0,
                total: null,
            },
        ]);
        expect(
            await api.prisma.sessionParticipant.count({ where: { sessionId: session.id } }),
        ).toBe(0);
    });
    it('should reject out-of-snapshot scores, unknown Movies and malformed matrices without partial writes', async () => {
        for (const selectionScaleMin of [0, 1]) {
            await api.prisma.club.update({ where: { id: clubId }, data: { selectionScaleMin } });
            for (const score of [selectionScaleMin - 1, 6]) {
                const input = buildInput();
                input.scoreMatrix = [
                    { membershipId: memberships[0]!, scores: [{ movieId: movieIds[0]!, score }] },
                ];
                expect([400, 409]).toContain((await create(input)).status);
            }
        }
        expect(
            (
                await create({
                    ...buildInput(),
                    nominations: [{ movieId: randomUUID() }],
                    scoreMatrix: [],
                })
            ).status,
        ).toBe(409);
        expect(
            (
                await create({
                    ...buildInput(),
                    nominations: [{ movieId: movieIds[0] }, { movieId: movieIds[0] }],
                })
            ).status,
        ).toBe(400);
        expect(
            (
                await create({
                    ...buildInput(),
                    scoreMatrix: [{ membershipId: randomUUID(), scores: [] }],
                })
            ).status,
        ).toBe(400);
        const foreignMembership = randomUUID();
        expect(
            (
                await create({
                    ...buildInput(),
                    attendees: [{ membershipId: foreignMembership }],
                    scoreMatrix: [
                        {
                            membershipId: foreignMembership,
                            scores: [{ movieId: movieIds[0], score: 1 }],
                        },
                    ],
                })
            ).status,
        ).toBe(409);
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(0);
        expect(await api.prisma.clubAuditEvent.count({ where: { clubId } })).toBe(0);
    });
    it('should replay reordered evidence after Club settings change and reject changed cells or nominations', async () => {
        const input = buildInput();
        expect((await create(input)).status).toBe(201);
        await api.prisma.club.update({
            where: { id: clubId },
            data: { selectionScaleMin: 1, selectionScaleMax: 2 },
        });
        const reordered = {
            ...input,
            nominations: [...input.nominations].reverse(),
            scoreMatrix: input.scoreMatrix
                .map((row) => ({ ...row, scores: [...row.scores].reverse() }))
                .reverse(),
        };
        expect((await create(reordered)).status).toBe(201);
        for (const patch of [
            { scoreMatrix: [] },
            { nominations: input.nominations.slice(0, 2) },
            {
                scoreMatrix: [
                    { membershipId: memberships[0], scores: [{ movieId: movieIds[0], score: 1 }] },
                ],
            },
        ]) {
            const response = await create({ ...input, ...patch });
            expect(response.status).toBe(409);
            expect(await response.json()).toMatchObject({
                error: { reason: 'SUBMISSION_MISMATCH' },
            });
        }
        expect((await get(input.submissionId)).selectionOutcome).toMatchObject({
            scaleMin: 0,
            scaleMax: 5,
        });
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(1);
        expect(await api.prisma.clubAuditEvent.count({ where: { clubId } })).toBe(1);
    });
    it('should retain participant attribution through departure and anonymization without copying names', async () => {
        await api.prisma.membership.update({
            where: { id: memberships[1] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const input = buildInput();
        expect((await create(input)).status).toBe(201);
        await api.prisma.user.update({
            where: { id: users[1] },
            data: { status: 'ANONYMIZED', displayName: 'Deleted user' },
        });
        const saved = await api.prisma.pastSelectionScore.findMany({
            where: { sessionId: input.submissionId },
            include: { participant: { include: { membership: { include: { user: true } } } } },
        });
        expect(saved.find((row) => row.score === 3)?.participant.membership.user.displayName).toBe(
            'Deleted user',
        );
        expect((await get(input.submissionId)).selectionOutcome?.nominations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ author: null, total: 8, scoreCount: 2 }),
            ]),
        );
    });
    it('should apply current plan and saved visibility before projecting imported evidence', async () => {
        const input = buildInput();
        expect((await create(input)).status).toBe(201);
        expect((await get(input.submissionId, users[1])).selectionOutcome?.nominations).toBeNull();
        vi.spyOn(tiers, 'getClubEntitlements').mockReturnValue(tiers.getTierEntitlements('PRO'));
        expect(
            (await get(input.submissionId, users[1])).selectionOutcome?.nominations,
        ).toHaveLength(3);
        expect(
            (await get(input.submissionId, users[2])).selectionOutcome?.nominations,
        ).toHaveLength(3);
        await api.prisma.session.update({
            where: { id: input.submissionId },
            data: { showVoteResults: false },
        });
        expect((await get(input.submissionId, users[1])).selectionOutcome?.nominations).toBeNull();
    });
    it('should retain known current and former non-attendee authors, unknown authors and anonymization visibility', async () => {
        await api.prisma.membership.update({
            where: { id: memberships[1] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const input = buildInput();
        input.attendees = [];
        input.scoreMatrix = [];
        input.nominations = movieIds.map((movieId, index) => ({
            movieId,
            nominatorMembershipId: index < 2 ? memberships[index] : undefined,
        }));
        expect((await create(input)).status).toBe(201);
        expect((await get(input.submissionId)).selectionOutcome.nominations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    movie: expect.objectContaining({ id: movieIds[0] }),
                    author: 'Test User',
                }),
                expect.objectContaining({
                    movie: expect.objectContaining({ id: movieIds[1] }),
                    author: 'Test User',
                }),
                expect.objectContaining({
                    movie: expect.objectContaining({ id: movieIds[2] }),
                    author: null,
                }),
            ]),
        );
        expect(
            await api.prisma.sessionParticipant.count({ where: { sessionId: input.submissionId } }),
        ).toBe(0);
        await api.prisma.user.update({
            where: { id: users[1] },
            data: { status: 'ANONYMIZED', displayName: 'Deleted user' },
        });
        expect((await get(input.submissionId)).selectionOutcome.nominations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    movie: expect.objectContaining({ id: movieIds[1] }),
                    author: 'Deleted user',
                }),
            ]),
        );
        await api.prisma.session.update({
            where: { id: input.submissionId },
            data: { showNominationAuthors: false },
        });
        const hidden = (await get(input.submissionId)).selectionOutcome;
        expect(hidden.nominations?.every((row) => row.author === null)).toBe(true);
        expect(JSON.stringify(hidden)).not.toMatch(
            /Deleted user|nominatorMembershipId|participantId|submittedAt|closedAt|winner|ranking/u,
        );
    });
    it('should match reordered attribution and reject adding, removing or changing authors on replay', async () => {
        const input = buildInput();
        input.nominations[0]!.nominatorMembershipId = memberships[1]!;
        expect((await create(input)).status).toBe(201);
        expect(
            (await create({ ...input, nominations: [...input.nominations].reverse() })).status,
        ).toBe(201);
        for (const nominations of [
            input.nominations.map(({ movieId }) => ({ movieId })),
            input.nominations.map((row, index) =>
                index === 0 ? { ...row, nominatorMembershipId: memberships[0] } : row,
            ),
            input.nominations.map((row, index) =>
                index === 1 ? { ...row, nominatorMembershipId: memberships[2] } : row,
            ),
        ]) {
            const response = await create({ ...input, nominations });
            expect(response.status).toBe(409);
            expect(await response.json()).toMatchObject({
                error: { reason: 'SUBMISSION_MISMATCH' },
            });
        }
        expect(await api.prisma.clubAuditEvent.count({ where: { clubId } })).toBe(1);
    });
    it('should reject foreign nominators at the API and database boundaries and keep attribution immutable', async () => {
        const foreignClub = await api.prisma.club.create({
            data: { id: randomUUID(), name: 'Other Club' },
        });
        const foreignMembership = await addMember(api.prisma, foreignClub.id, users[0]!, 'ADMIN');
        const input = { ...buildInput(), attendees: [], scoreMatrix: [] };
        const response = await create({
            ...input,
            nominations: [{ movieId: movieIds[0], nominatorMembershipId: foreignMembership }],
        });
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: { reason: 'NOMINATOR_UNAVAILABLE' } });
        expect(await api.prisma.session.count({ where: { clubId } })).toBe(0);
        input.nominations = [{ movieId: movieIds[0]!, nominatorMembershipId: memberships[1]! }];
        expect((await create(input)).status).toBe(201);
        await expect(
            api.prisma.pastNomination.create({
                data: {
                    sessionId: input.submissionId,
                    movieId: movieIds[1]!,
                    nominatorMembershipId: foreignMembership,
                },
            }),
        ).rejects.toThrow('same Club');
        const nomination = await api.prisma.pastNomination.findFirstOrThrow({
            where: { sessionId: input.submissionId },
        });
        await expect(
            api.prisma.pastNomination.update({
                where: { id: nomination.id },
                data: { nominatorMembershipId: memberships[0] },
            }),
        ).rejects.toThrow('immutable');
        await expect(
            api.prisma.membership.update({
                where: { id: memberships[1] },
                data: { clubId: foreignClub.id },
            }),
        ).rejects.toThrow('same Club');
        await expect(
            api.prisma.session.update({
                where: { id: input.submissionId },
                data: { clubId: foreignClub.id },
            }),
        ).rejects.toThrow('same Club');
    });
    it('should enforce provenance, scale, immutability and same-Session attribution in the database', async () => {
        const input = buildInput();
        expect((await create(input)).status).toBe(201);
        const nomination = await api.prisma.pastNomination.findFirstOrThrow({
            where: { sessionId: input.submissionId, movieId: movieIds[0] },
        });
        const participant = await api.prisma.sessionParticipant.findFirstOrThrow({
            where: { sessionId: input.submissionId, membershipId: memberships[2] },
        });
        await expect(
            api.prisma.pastSelectionScore.create({
                data: {
                    sessionId: input.submissionId,
                    nominationId: nomination.id,
                    participantId: participant.id,
                    score: 6,
                },
            }),
        ).rejects.toThrow('outside the Session scale');
        await expect(
            api.prisma.pastNomination.update({
                where: { id: nomination.id },
                data: { movieId: movieIds[1] },
            }),
        ).rejects.toThrow('immutable');
        const score = await api.prisma.pastSelectionScore.findFirstOrThrow({
            where: { nominationId: nomination.id },
        });
        await expect(
            api.prisma.pastSelectionScore.update({
                where: {
                    nominationId_participantId: {
                        nominationId: score.nominationId,
                        participantId: score.participantId,
                    },
                },
                data: { score: 1 },
            }),
        ).rejects.toThrow('immutable');
        const live = await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'COMPLETED',
        });
        await expect(
            api.prisma.pastNomination.create({
                data: { sessionId: live.id, movieId: movieIds[0]! },
            }),
        ).rejects.toThrow('Completed past Session');
        const other = { ...buildInput(), scoreMatrix: [] };
        expect((await create(other)).status).toBe(201);
        const foreignParticipant = await api.prisma.sessionParticipant.findFirstOrThrow({
            where: { sessionId: other.submissionId },
        });
        await expect(
            api.prisma.pastSelectionScore.create({
                data: {
                    sessionId: input.submissionId,
                    nominationId: nomination.id,
                    participantId: foreignParticipant.id,
                    score: 2,
                },
            }),
        ).rejects.toThrow();
    });
});
