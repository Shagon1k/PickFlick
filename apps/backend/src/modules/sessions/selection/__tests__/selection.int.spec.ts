import { randomUUID } from 'node:crypto';

import { sessionSchema, type TSubmitSelection } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';

describe('Selection ballots', () => {
    let api: ITestApi;
    let admin: string;
    let member: string;
    let outsider: string;
    let clubId: string;
    let sessionId: string;
    let participantId: string;
    let nominationIds: string[];
    let movieId: string;

    beforeAll(async () => {
        api = await startTestApi();
        admin = await createUser(api.prisma);
        member = await createUser(api.prisma);
        outsider = await createUser(api.prisma);
        movieId = (await api.prisma.movie.create({ data: { title: 'Selection Movie' } })).id;
    });
    beforeEach(async () => {
        clubId = randomUUID();
        sessionId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Selection Club' } });
        const adminMembership = await addMember(api.prisma, clubId, admin, 'ADMIN');
        const membershipId = await addMember(api.prisma, clubId, member);
        await createSession(api.prisma, clubId, {
            id: sessionId,
            type: 'FULL_CYCLE',
            phase: 'SELECTION',
            selectionScaleMin: 0,
            selectionScaleMax: 3,
        });
        nominationIds = [];
        for (const membership of [adminMembership, membershipId]) {
            const participant = await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId: membership, status: 'ACCEPTED' },
            });
            const nomination = await api.prisma.nomination.create({
                data: { sessionId, participantId: participant.id, movieId, isInSelection: true },
            });
            nominationIds.push(nomination.id);
            if (membership === membershipId) participantId = participant.id;
        }
    });
    afterAll(async () => {
        await removeUsers(api.prisma, [admin, member, outsider]);
        await api.prisma.movie.delete({ where: { id: movieId } });
        await api.close();
    });

    const ballot = (score = 1): TSubmitSelection => ({
        scores: nominationIds.map((nominationId) => ({ nominationId, score })),
    });
    const submit = (input: unknown = ballot(), userId: string | undefined = member) =>
        api.request(`/sessions/${sessionId}/selection`, { method: 'POST', userId, json: input });
    const read = async (userId = member) => {
        const response = await api.request(`/sessions/${sessionId}`, { userId });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        const selection = sessionSchema.parse(await response.json()).selection;
        expect(selection).not.toBeNull();
        return selection!;
    };

    it('should accept both endpoints of every supported Session scale without using current Club settings', async () => {
        for (const min of [0, 1]) {
            for (let max = min + 1; max <= 10; max++) {
                await api.prisma.session.update({
                    where: { id: sessionId },
                    data: { selectionScaleMin: min, selectionScaleMax: max },
                });
                await api.prisma.selectionScore.deleteMany({ where: { sessionId } });
                await api.prisma.selectionBallot.deleteMany({ where: { sessionId } });
                const scores = {
                    scores: [
                        { nominationId: nominationIds[0]!, score: min },
                        { nominationId: nominationIds[1]!, score: max },
                    ],
                };
                expect((await submit(scores)).status).toBe(201);
                const data = await read();
                expect(data).toMatchObject({
                    scaleMin: min,
                    scaleMax: max,
                    canSubmit: false,
                    acceptedCount: 2,
                    submittedCount: 1,
                });
                expect(
                    data.nominations.map((row) => row.ownScore).toSorted((a, b) => a! - b!),
                ).toEqual([min, max]);
            }
        }
    });

    it('should reject incomplete, duplicate, extra and foreign nominations atomically', async () => {
        for (const scores of [
            [],
            [ballot().scores[0]],
            [ballot().scores[0], ballot().scores[0]],
            [...ballot().scores, { nominationId: randomUUID(), score: 1 }],
            [ballot().scores[0], { nominationId: randomUUID(), score: 1 }],
        ]) {
            expect((await submit({ scores })).status).toBe(scores.length === 0 ? 400 : 409);
        }
        expect(await api.prisma.selectionBallot.count({ where: { sessionId } })).toBe(0);
        expect(await api.prisma.selectionScore.count({ where: { sessionId } })).toBe(0);
    });

    it('should validate integer scores against both the boundary and the Session range', async () => {
        for (const score of [-1, 11, 1.5, '2', null])
            expect(
                (
                    await submit({
                        scores: nominationIds.map((nominationId) => ({ nominationId, score })),
                    })
                ).status,
            ).toBe(400);
        expect((await submit(ballot(4))).status).toBe(409);
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { selectionScaleMin: 1 },
        });
        expect((await submit(ballot(0))).status).toBe(409);
        expect(await api.prisma.selectionBallot.count({ where: { sessionId } })).toBe(0);
    });

    it('should serialize concurrent submissions and preserve the first committed ballot on retries', async () => {
        const responses = await Promise.all([submit(ballot(0)), submit(ballot(3))]);
        expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
            201, 409,
        ]);
        const saved = await api.prisma.selectionBallot.findUniqueOrThrow({
            where: { participantId_sessionId: { participantId, sessionId } },
            include: { scores: true },
        });
        expect(saved.scores).toHaveLength(2);
        expect(new Set(saved.scores.map((row) => row.score)).size).toBe(1);
        expect((await submit(ballot(2))).status).toBe(409);
        expect(
            await api.prisma.selectionBallot.findUnique({
                where: { id: saved.id },
                include: { scores: true },
            }),
        ).toEqual(saved);
        expect(await api.prisma.selectionBallot.count({ where: { sessionId } })).toBe(1);
        const session = await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
        expect(session.progressVersion).toBe(2);
        expect(await api.prisma.sessionProgressEvent.count({ where: { sessionId } })).toBe(1);
    });

    it('should enforce ballot and score uniqueness, scalar bounds and same-Session links in PostgreSQL', async () => {
        await submit();
        const saved = await api.prisma.selectionBallot.findFirstOrThrow({ where: { sessionId } });
        await expect(
            api.prisma.selectionBallot.create({ data: { sessionId, participantId } }),
        ).rejects.toMatchObject({ code: 'P2002' });
        await expect(
            api.prisma.selectionScore.create({
                data: { ballotId: saved.id, sessionId, nominationId: nominationIds[0]!, score: 1 },
            }),
        ).rejects.toMatchObject({ code: 'P2002' });
        const otherSession = await createSession(api.prisma, clubId, {
            type: 'FULL_CYCLE',
            phase: 'COMPLETED',
        });
        await expect(
            api.prisma.selectionBallot.create({
                data: { sessionId: otherSession.id, participantId },
            }),
        ).rejects.toMatchObject({ code: 'P2003' });
        const membership = await api.prisma.membership.findFirstOrThrow({
            where: { clubId, userId: admin },
        });
        const otherParticipant = await api.prisma.sessionParticipant.create({
            data: { sessionId: otherSession.id, clubId, membershipId: membership.id },
        });
        const foreign = await api.prisma.nomination.create({
            data: { sessionId: otherSession.id, participantId: otherParticipant.id, movieId },
        });
        await expect(
            api.prisma.selectionScore.create({
                data: { ballotId: saved.id, sessionId, nominationId: foreign.id, score: 1 },
            }),
        ).rejects.toMatchObject({ code: 'P2003' });
        await expect(
            api.prisma
                .$executeRaw`UPDATE "SelectionScore" SET score = 11 WHERE "ballotId" = ${saved.id}::uuid`,
        ).rejects.toThrow('SelectionScore_score_check');
    });

    it('should deny unauthenticated, nonmember and unaccepted participants and archived or closed writes', async () => {
        expect(
            (
                await api.request(`/sessions/${sessionId}/selection`, {
                    method: 'POST',
                    json: ballot(),
                })
            ).status,
        ).toBe(401);
        expect((await submit(ballot(), outsider)).status).toBe(404);
        for (const status of ['INVITED', 'DECLINED', 'LEFT', 'REMOVED'] as const) {
            await api.prisma.sessionParticipant.update({
                where: { id: participantId },
                data: { status },
            });
            expect((await submit()).status).toBe(403);
        }
        await api.prisma.sessionParticipant.update({
            where: { id: participantId },
            data: { status: 'ACCEPTED' },
        });
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await submit()).status).toBe(409);
        expect((await read()).canSubmit).toBe(false);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        for (const phase of [
            'NOMINATION',
            'WATCHING',
            'RATING',
            'COMPLETED',
            'CANCELLED',
        ] as const) {
            await api.prisma.session.update({ where: { id: sessionId }, data: { phase } });
            expect((await submit()).status).toBe(409);
        }
    });

    it('should preserve a departed participants own ballot and deny access after Club departure', async () => {
        expect((await submit()).status).toBe(201);
        expect(
            (
                await api.request(`/sessions/${sessionId}/leave`, {
                    method: 'POST',
                    userId: member,
                    json: { confirmation: 'LEAVE' },
                })
            ).status,
        ).toBe(204);
        const data = await read();
        expect(data).toMatchObject({ acceptedCount: 1, submittedCount: 0, canSubmit: false });
        expect(data.submittedAt).not.toBeNull();
        expect(data.nominations.every((row) => row.ownScore === 1)).toBe(true);
        await api.prisma.membership.updateMany({
            where: { clubId, userId: member },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        await api.expectStatus(404, `/sessions/${sessionId}`, { userId: member });
        expect((await submit()).status).toBe(404);
    });

    it('should expose only own scores and filter nominator identities independently', async () => {
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { showNominationAuthors: false, showVoteResults: false },
        });
        await submit(ballot(3), admin);
        const data = await read();
        expect(data).toMatchObject({ submittedCount: 1, submittedAt: null, canSubmit: true });
        expect(data.nominations.every((row) => row.ownScore === null && row.author === null)).toBe(
            true,
        );
        expect((await read(admin)).nominations.every((row) => row.ownScore === 3)).toBe(true);
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { showNominationAuthors: true },
        });
        expect((await read()).nominations.every((row) => row.author === 'Test User')).toBe(true);
    });

    it('should freeze eligible nominations at transition and preserve that set after a departure', async () => {
        await api.prisma.nomination.deleteMany({ where: { sessionId } });
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { phase: 'NOMINATION' },
        });
        const membershipId = await addMember(api.prisma, clubId, outsider);
        const departed = await api.prisma.sessionParticipant.create({
            data: { sessionId, clubId, membershipId, status: 'LEFT' },
        });
        await api.prisma.nomination.create({
            data: { sessionId, participantId: departed.id, movieId },
        });
        for (const userId of [admin, member])
            expect(
                (
                    await api.request(`/sessions/${sessionId}/nominations`, {
                        method: 'POST',
                        userId,
                        json: { movieId },
                    })
                ).status,
            ).toBe(201);
        const data = await read();
        expect(data.nominations).toHaveLength(2);
        nominationIds = data.nominations.map((row) => row.id);
        expect((await submit()).status).toBe(201);
        expect(
            (
                await api.request(`/sessions/${sessionId}/leave`, {
                    method: 'POST',
                    userId: admin,
                    json: { confirmation: 'LEAVE' },
                })
            ).status,
        ).toBe(204);
        const saved = await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
        expect(saved.phase).toBe('WATCHING');
        expect(saved.selectionResult).toMatchObject({
            inputs: {
                nominations: nominationIds
                    .toSorted((a, b) => a.localeCompare(b))
                    .map((id) => ({ id })),
            },
        });
    });
});
