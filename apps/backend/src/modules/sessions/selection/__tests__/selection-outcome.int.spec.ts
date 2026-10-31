import { randomUUID } from 'node:crypto';

import { sessionSchema } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import * as tiers from '../../../clubs/access/club-tiers.js';

describe('Selection outcome', () => {
    let api: ITestApi;
    let users: string[];
    let clubId: string;
    let sessionId: string;
    let nominations: string[];
    let movieIds: string[];

    beforeAll(async () => {
        api = await startTestApi();
        movieIds = await Promise.all(
            ['First pick', 'Second pick'].map(
                async (title) => (await api.prisma.movie.create({ data: { title } })).id,
            ),
        );
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 4 }, () => createUser(api.prisma)));
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Private results' } });
        sessionId = (
            await createSession(api.prisma, clubId, {
                type: 'FULL_CYCLE',
                phase: 'SELECTION',
                selectionScaleMin: 0,
                selectionScaleMax: 3,
            })
        ).id;
        nominations = [];
        for (const [index, role] of (['ADMIN', 'MODERATOR', 'MEMBER'] as const).entries()) {
            const membershipId = await addMember(api.prisma, clubId, users[index]!, role);
            const participant = await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId, status: 'ACCEPTED' },
            });
            if (index < 2)
                nominations.push(
                    (
                        await api.prisma.nomination.create({
                            data: {
                                sessionId,
                                participantId: participant.id,
                                movieId: movieIds[index]!,
                                isInSelection: true,
                                submittedAt: new Date(`2026-10-${10 + index}T12:00:00Z`),
                            },
                        })
                    ).id,
                );
        }
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        await removeUsers(api.prisma, users);
    });
    afterAll(async () => {
        await api.prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
        await api.close();
    });

    async function read(userId = users[2]) {
        const response = await api.request(`/sessions/${sessionId}`, { userId });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        const body: unknown = await response.json();
        expect(body).not.toHaveProperty('selectionResult');
        const detail = sessionSchema.parse(body);
        expect(JSON.stringify(detail.selectionOutcome)).not.toMatch(
            /participantId|externalIds|recipientIds|membershipId|"scores"|"inputs"/u,
        );
        if (detail.selectionOutcome?.source === 'IMPORTED')
            throw new Error('Expected live outcome');
        return { ...detail, selectionOutcome: detail.selectionOutcome };
    }
    async function close() {
        const response = await api.request(`/sessions/${sessionId}/selection/close`, {
            method: 'POST',
            userId: users[0],
            json: { confirmation: 'CLOSE', phaseVersion: 1 },
        });
        expect(response.status).toBe(201);
    }
    async function submit() {
        const response = await api.request(`/sessions/${sessionId}/selection`, {
            method: 'POST',
            userId: users[0],
            json: {
                scores: nominations.map((nominationId, index) => ({
                    nominationId,
                    score: index === 0 ? 3 : 1,
                })),
            },
        });
        expect(response.status).toBe(201);
    }

    async function complete() {
        expect(
            (
                await api.request(`/sessions/${sessionId}/rating/open`, {
                    method: 'POST',
                    userId: users[0],
                    json: { confirmation: 'OPEN', phaseVersion: 2 },
                })
            ).status,
        ).toBe(201);
        expect(
            (
                await api.request(`/sessions/${sessionId}/rating`, {
                    method: 'POST',
                    userId: users[0],
                    json: { score: 8, comment: 'Historical response' },
                })
            ).status,
        ).toBe(201);
        expect(
            (
                await api.request(`/sessions/${sessionId}/rating/close`, {
                    method: 'POST',
                    userId: users[0],
                    json: { confirmation: 'CLOSE', phaseVersion: 3 },
                })
            ).status,
        ).toBe(201);
    }

    it.each([
        { tier: 'FREE', show: false, hasBreakdown: false },
        { tier: 'FREE', show: true, hasBreakdown: false },
        { tier: 'PRO', show: false, hasBreakdown: false },
        { tier: 'PRO', show: true, hasBreakdown: true },
    ] as const)(
        'should filter $tier post-close results with visibility $show',
        async ({ tier, show, hasBreakdown }) => {
            vi.spyOn(tiers, 'getClubEntitlements').mockReturnValue(tiers.getTierEntitlements(tier));
            await api.prisma.session.update({
                where: { id: sessionId },
                data: { showVoteResults: show, showNominationAuthors: false },
            });
            await submit();
            expect((await read()).selectionOutcome).toBeNull();
            await close();
            await complete();
            const detail = await read();
            expect(detail.selection).toBeNull();
            expect(detail.selectionOutcome).toMatchObject({
                source: 'LIVE',
                winner: { id: movieIds[0] },
                author: null,
                closure: 'MANUAL',
            });
            expect(Boolean(detail.selectionOutcome?.breakdown)).toBe(hasBreakdown);
            for (const userId of users.slice(0, 2)) {
                const outcome = (await read(userId)).selectionOutcome;
                expect(outcome?.breakdown).toMatchObject({
                    ballotCount: 1,
                    reason: 'TOTAL',
                    scaleMin: 0,
                    scaleMax: 3,
                    ranking: [
                        { total: 3, maximumCount: 1, supporterCount: 1, author: null },
                        { total: 1, maximumCount: 0, supporterCount: 1, author: null },
                    ],
                });
            }
        },
    );

    it('should preserve frozen metrics and closure across retries, reads and later source changes', async () => {
        await submit();
        await close();
        const saved = (await read(users[0])).selectionOutcome;
        await api.prisma.selectionScore.updateMany({ where: { sessionId }, data: { score: 0 } });
        await api.prisma.nomination.updateMany({
            where: { sessionId },
            data: { submittedAt: new Date() },
        });
        await api.prisma.sessionParticipant.updateMany({
            where: { sessionId },
            data: { status: 'LEFT' },
        });
        await close();
        expect((await read(users[0])).selectionOutcome).toEqual(saved);
        expect(saved?.author).toBe('Test User');
        expect(saved?.breakdown?.ranking.every((row) => row.author === 'Test User')).toBe(true);
        const events = await api.prisma.sessionProgressEvent.findMany({
            where: { sessionId },
            orderBy: { version: 'asc' },
        });
        expect(events.map((row) => [row.kind, row.phase])).toEqual([
            ['PROGRESS', 'SELECTION'],
            ['MANUAL', 'WATCHING'],
        ]);
        await api.expectStatus(200, `/sessions/${sessionId}/progress`, { userId: users[2] });
    });

    it('should recheck current tier and role while keeping the Session visibility snapshot', async () => {
        const entitlement = vi
            .spyOn(tiers, 'getClubEntitlements')
            .mockReturnValue(tiers.getTierEntitlements('PRO'));
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { showVoteResults: true },
        });
        await close();
        expect((await read()).selectionOutcome?.breakdown).toMatchObject({
            ballotCount: 0,
            reason: 'NOMINATION_TIME',
        });
        await api.prisma.club.update({ where: { id: clubId }, data: { showVoteResults: false } });
        expect((await read()).selectionOutcome?.breakdown).not.toBeNull();
        entitlement.mockReturnValue(tiers.getTierEntitlements('FREE'));
        expect((await read()).selectionOutcome?.breakdown).toBeNull();
        await api.prisma.membership.updateMany({
            where: { clubId, userId: users[0] },
            data: { role: 'MEMBER' },
        });
        expect((await read(users[0])).selectionOutcome?.breakdown).toBeNull();
    });

    it('should retain Completed inputs after Club changes and departure and reject historical mutations', async () => {
        await submit();
        await close();
        await complete();
        const before = await read(users[1]);
        const rosterBefore = await (
            await api.request(`/sessions/${sessionId}/roster`, { userId: users[1] })
        ).json();
        await api.prisma.club.update({
            where: { id: clubId },
            data: {
                selectionScaleMax: 10,
                showVoteResults: false,
                showNominationAuthors: false,
                showRatingResults: false,
            },
        });
        await api.prisma.selectionScore.updateMany({ where: { sessionId }, data: { score: 0 } });
        const leave = await api.request(`/clubs/${clubId}/leave`, {
            method: 'POST',
            userId: users[2],
            json: { confirmation: 'LEAVE' },
        });
        expect(leave.status).toBe(204);
        expect(await read(users[1])).toEqual(before);
        expect(
            await (await api.request(`/sessions/${sessionId}/roster`, { userId: users[1] })).json(),
        ).toEqual(rosterBefore);
        expect(before).toMatchObject({
            phase: 'COMPLETED',
            canManage: false,
            rating: { receivedCount: 1, results: { average: 8 } },
        });
        for (const [path, json] of [
            [
                '',
                {
                    version: before.version,
                    scheduledAt: '2090-12-01T00:00:00Z',
                    location: 'Changed',
                    deadlineAt: null,
                },
            ],
            ['/cancel', { version: before.version, confirmation: 'CANCEL' }],
            ['/participation', { decision: 'accept' }],
        ] as const) {
            expect(
                (
                    await api.request(`/sessions/${sessionId}${path}`, {
                        userId: users[0],
                        method: path ? 'POST' : 'PATCH',
                        json,
                    })
                ).status,
            ).toBe(409);
        }
        await api.expectStatus(404, `/sessions/${sessionId}`, { userId: users[2] });
    });

    it('should deny unauthenticated, nonmember and departed access to results and progress', async () => {
        await close();
        await api.prisma.user.update({ where: { id: users[3] }, data: { appRole: 'APP_ADMIN' } });
        for (const path of [`/sessions/${sessionId}`, `/sessions/${sessionId}/progress`]) {
            await api.expectStatus(401, path);
            await api.expectStatus(404, path, { userId: users[3] });
            await api.prisma.membership.updateMany({
                where: { clubId, userId: users[2] },
                data: { status: 'LEFT', leftAt: new Date() },
            });
            await api.expectStatus(404, path, { userId: users[2] });
        }
    });
});
