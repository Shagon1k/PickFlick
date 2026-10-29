import { randomUUID } from 'node:crypto';

import { clubRatingsSchema, type IClubHub } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import * as tiers from '../../access/club-tiers.js';

describe('Club ratings API', () => {
    let api: ITestApi;
    let clubId: string;
    let users: string[];
    let memberships: string[];
    let movieIds: string[];
    let isPro = true;

    beforeAll(async () => {
        api = await startTestApi();
        clubId = randomUUID();
        users = await Promise.all(Array.from({ length: 4 }, () => createUser(api.prisma)));
        memberships = [];
        movieIds = Array.from({ length: 3 }, () => randomUUID());
        await api.prisma.club.create({ data: { id: clubId, name: 'Analytics fixture' } });
        for (const [index, role] of (['ADMIN', 'MODERATOR', 'MEMBER'] as const).entries()) {
            memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
        }
        await api.prisma.user.update({ where: { id: users[3] }, data: { appRole: 'APP_ADMIN' } });
        for (const [index, title] of ['Repeated film', 'Highest film', 'Hidden film'].entries()) {
            await api.prisma.movie.create({ data: { id: movieIds[index]!, title } });
        }
        const original = tiers.getClubEntitlements;
        vi.spyOn(tiers, 'getClubEntitlements').mockImplementation((id) => {
            if (id !== clubId) return original(id);
            return tiers.getTierEntitlements(isPro ? 'PRO' : 'FREE');
        });
        await addScreening(0, [10, 2]);
        await addScreening(0, [9]);
        await addScreening(1, [9]);
        await addScreening(2, [1], false);
        await addScreening(0, []);
        const live = await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'RATING',
            movieId: movieIds[1]!,
        });
        const participant = await api.prisma.sessionParticipant.create({
            data: { clubId, sessionId: live.id, membershipId: memberships[0]!, status: 'ACCEPTED' },
        });
        await api.prisma.sessionRating.create({
            data: { sessionId: live.id, participantId: participant.id, score: 1 },
        });
        await createSession(api.prisma, clubId, {
            type: 'PAST',
            phase: 'CANCELLED',
            movieId: movieIds[0]!,
        });
    });

    async function addScreening(movieIndex: number, scores: number[], canShowRatingResults = true) {
        const session = await createSession(api.prisma, clubId, {
            type: 'PAST',
            phase: 'COMPLETED',
            movieId: movieIds[movieIndex]!,
            scheduledAt: new Date('2026-01-01Z'),
            showRatingResults: canShowRatingResults,
        });
        for (const [index, score] of scores.entries()) {
            const participant = await api.prisma.sessionParticipant.create({
                data: {
                    clubId,
                    sessionId: session.id,
                    membershipId: memberships[index]!,
                    status: index === 1 ? 'LEFT' : 'ACCEPTED',
                },
            });
            await api.prisma.sessionRating.create({
                data: {
                    sessionId: session.id,
                    participantId: participant.id,
                    score,
                    submittedAt: null,
                    comment: 'Private historical comment',
                },
            });
        }
    }

    afterAll(async () => {
        vi.restoreAllMocks();
        await removeUsers(api.prisma, users);
        await api.prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
        await api.close();
    });

    it('should aggregate received past ratings including departed participants with stable retries and no individual data', async () => {
        await api.prisma.personalMovieRating.create({
            data: { userId: users[0]!, movieId: movieIds[0]!, score: 1, source: 'PERSONAL' },
        });
        const response = await api.request(`/clubs/${clubId}/ratings`, { userId: users[0]! });
        const body: unknown = await response.json();
        const result = clubRatingsSchema.parse(body);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(result.items).toMatchObject([
            { movieId: movieIds[1], averageRating: 9 },
            { movieId: movieIds[0], averageRating: 7 },
            { movieId: movieIds[2], averageRating: 1 },
        ]);
        expect(
            await (await api.request(`/clubs/${clubId}/ratings`, { userId: users[0]! })).json(),
        ).toEqual(body);
        expect(JSON.stringify(body)).not.toMatch(
            /Private historical comment|participantId|membershipId|"score"|"ratings"/u,
        );
        const hub = (await (
            await api.request(`/clubs/${clubId}/hub`, { userId: users[0]! })
        ).json()) as IClubHub;
        expect(hub.statistics).toMatchObject({
            sessionsWatched: 5,
            averageRating: 6.2,
            totalWatchHours: null,
        });
    });

    it('should filter hidden results before averages and ordering, and recheck role and saved settings', async () => {
        const read = async (index: number) =>
            clubRatingsSchema.parse(
                await (
                    await api.request(`/clubs/${clubId}/ratings?sort=title`, {
                        userId: users[index]!,
                    })
                ).json(),
            );
        expect((await read(1)).total).toBe(3);
        expect((await read(2)).items.map(({ title }) => title)).toEqual([
            'Highest film',
            'Repeated film',
        ]);
        const hub = (await (
            await api.request(`/clubs/${clubId}/hub`, { userId: users[2]! })
        ).json()) as IClubHub;
        expect(hub.statistics.averageRating).toBe(7.5);
        await api.prisma.club.update({ where: { id: clubId }, data: { showRatingResults: true } });
        expect((await read(2)).total).toBe(2);
        await api.prisma.membership.update({
            where: { id: memberships[1] },
            data: { role: 'MEMBER' },
        });
        expect((await read(1)).total).toBe(2);
    });

    it('should project only basic analytics for every Free role while preserving history', async () => {
        isPro = false;
        for (const userId of users.slice(0, 3)) {
            const result = clubRatingsSchema.parse(
                await (await api.request(`/clubs/${clubId}/ratings`, { userId })).json(),
            );
            expect(result).toMatchObject({ analytics: 'BASIC', items: [], total: 0 });
            const hub = (await (
                await api.request(`/clubs/${clubId}/hub`, { userId })
            ).json()) as IClubHub;
            expect(hub.statistics).toEqual({
                sessionsWatched: 5,
                sessionsThisYear: new Date().getUTCFullYear() === 2026 ? 5 : 0,
                averageRating: null,
                totalWatchHours: null,
                topGenre: null,
                topDirector: null,
                topActor: null,
            });
        }
        isPro = true;
        expect(
            clubRatingsSchema.parse(
                await (await api.request(`/clubs/${clubId}/ratings`, { userId: users[0]! })).json(),
            ).total,
        ).toBe(3);
    });

    it('should reject anonymous, foreign App Admin, departed and malformed requests without Club disclosure', async () => {
        await api.expectStatus(401, `/clubs/${clubId}/ratings`);
        const denied = await api.request(`/clubs/${clubId}/ratings`, { userId: users[3]! });
        expect(denied.status).toBe(404);
        expect(await denied.text()).not.toContain('Analytics fixture');
        for (const query of [
            'sort=unknown',
            'page=0',
            'sort=title&sort=time',
            'page=1&page=2',
            'userId=other',
        ]) {
            await api.expectStatus(400, `/clubs/${clubId}/ratings?${query}`, { userId: users[0]! });
        }
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        await api.expectStatus(200, `/clubs/${clubId}/ratings`, { userId: users[2]! });
        await api.prisma.membership.update({
            where: { id: memberships[2] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        await api.expectStatus(404, `/clubs/${clubId}/ratings`, { userId: users[2]! });
    });
});
