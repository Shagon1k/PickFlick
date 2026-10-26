import { randomUUID } from 'node:crypto';

import { achievementsSchema } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    loadIntegrationEnvironment,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';
import { buildCanonicalDetails } from '../../../testing/movie-fixtures.js';
import { buildDetailsCacheKey } from '../../movies/catalog-cache-key.js';
import { ACHIEVEMENT_DEFINITIONS } from '../rules/rule-catalog.js';

describe('Achievements API', () => {
    let api: ITestApi;
    let users: string[];
    const clubId = randomUUID();
    const movies = Array.from({ length: 10 }, () => randomUUID());
    beforeAll(async () => {
        api = await startTestApi();
        users = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        await api.prisma.club.create({ data: { id: clubId, name: 'Achievement test' } });
        await addMember(api.prisma, clubId, users[0]!, 'ADMIN');
        await api.prisma.movie.createMany({ data: movies.map((id) => ({ id })) });
        await api.prisma.personalMovieRating.createMany({
            data: movies.map((movieId) => ({
                movieId,
                userId: users[0]!,
                score: 8,
                source: 'PERSONAL',
            })),
        });
        const session = await createSession(api.prisma, clubId, {
            type: 'PAST',
            phase: 'COMPLETED',
            movieId: movies[0],
            scheduledAt: new Date(),
        });
        const member = await api.prisma.membership.findFirstOrThrow({ where: { clubId } });
        const participant = await api.prisma.sessionParticipant.create({
            data: {
                clubId,
                sessionId: session.id,
                membershipId: member.id,
                status: 'ACCEPTED',
                attended: true,
            },
        });
        await api.prisma.sessionRating.create({
            data: {
                sessionId: session.id,
                participantId: participant.id,
                score: 10,
                submittedAt: null,
            },
        });
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.deleteMany({ where: { id: { in: movies } } });
        await api.close();
    });
    async function read(path = '/library/achievements', userId = users[0]) {
        const response = await api.request(path, { userId });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        return achievementsSchema.parse(await response.json());
    }

    it('should isolate owners, reject selectors, and deduplicate concurrent retry awards', async () => {
        const results = await Promise.all([read(), read()]);
        expect(results[0]).toEqual(results[1]);
        expect(results[0].items.find((item) => item.key === 'archivist')).toMatchObject({
            status: 'unlocked',
            progress: 10,
        });
        expect(
            (await read('/library/achievements', users[1])).items.find(
                (item) => item.key === 'archivist',
            ),
        ).toMatchObject({ progress: 0, awardedAt: null });
        expect(
            await api.prisma.achievementAward.count({
                where: { userId: users[0], key: 'archivist' },
            }),
        ).toBe(1);
        expect((await api.request('/library/achievements')).status).toBe(401);
        expect(
            (await api.request(`/library/achievements?userId=${users[0]}`, { userId: users[1] }))
                .status,
        ).toBe(400);
        expect(
            (await api.request(`/clubs/${clubId}/achievements`, { userId: users[1] })).status,
        ).toBe(404);
    });

    it('should preserve earned evidence and rule history when facts and definitions change', async () => {
        const definition = ACHIEVEMENT_DEFINITIONS.find(
            (item) => item.scope === 'PERSONAL' && item.key === 'archivist',
        )!;
        const original = { ...definition };
        const before = await api.prisma.achievementAward.findFirstOrThrow({
            where: { userId: users[0], key: 'archivist' },
        });
        await api.prisma.personalMovieRating.deleteMany({ where: { userId: users[0] } });
        try {
            definition.version = 2;
            definition.target = 20;
            definition.title = 'Archivist, second edition';
            const { items } = await read();
            expect(items.filter((item) => item.key === 'archivist')).toMatchObject([
                { version: 1, title: 'Archivist', status: 'unlocked', progress: 10, target: 10 },
                {
                    version: 2,
                    title: 'Archivist, second edition',
                    status: 'not-started',
                    progress: 0,
                    target: 20,
                },
            ]);
            expect(
                await api.prisma.achievementAward.findUniqueOrThrow({ where: { id: before.id } }),
            ).toEqual(before);
            await expect(
                api.prisma.achievementAward.update({
                    where: { id: before.id },
                    data: { progress: 0 },
                }),
            ).rejects.toThrow('immutable');
        } finally {
            Object.assign(definition, original);
        }
    });

    it('should award imported attendance and ratings across historical Membership records after rejoining', async () => {
        const historicalClubId = randomUUID();
        await api.prisma.club.create({ data: { id: historicalClubId, name: 'Rejoined history' } });
        const oldId = await addMember(api.prisma, historicalClubId, users[0]!, 'ADMIN');
        await api.prisma.membership.update({
            where: { id: oldId },
            data: {
                joinedAt: new Date('2019-01-01'),
                leftAt: new Date('2021-01-01'),
                status: 'LEFT',
            },
        });
        const currentId = await addMember(api.prisma, historicalClubId, users[0]!, 'ADMIN');
        await api.prisma.membership.update({
            where: { id: currentId },
            data: { joinedAt: new Date('2022-01-01') },
        });
        const response = await api.request(`/clubs/${historicalClubId}/sessions/past`, {
            userId: users[0],
            method: 'POST',
            json: {
                submissionId: randomUUID(),
                scheduledAt: '2020-01-01T20:00:00Z',
                location: 'Old cinema',
                movieId: movies[0],
                attendees: [{ membershipId: currentId, score: 8 }],
            },
        });
        expect(response.status).toBe(201);
        const { items } = await read(`/clubs/${historicalClubId}/achievements`);
        for (const key of ['full-house', 'critics-circle']) {
            expect(items.find((item) => item.key === key)).toMatchObject({
                progress: 1,
                status: 'unlocked',
            });
        }
    });

    it('should retain earned genre evidence across configured metadata refresh', async () => {
        const environment = loadIntegrationEnvironment();
        const key = buildDetailsCacheKey(environment.catalog.provider, environment.catalog.locale);
        const data = { ...buildCanonicalDetails(), genres: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] };
        await api.prisma.movieDetailsCache.create({
            data: { movieId: movies[0]!, key, data, fetchedAt: new Date() },
        });
        expect(
            (await read(`/clubs/${clubId}/achievements`)).items.find(
                (item) => item.key === 'genre-roulette',
            ),
        ).toMatchObject({ status: 'unlocked', progress: 7 });
        const before = await api.prisma.achievementAward.findFirstOrThrow({
            where: { clubId, key: 'genre-roulette' },
        });
        await api.prisma.movieDetailsCache.update({
            where: { movieId_key: { movieId: movies[0]!, key } },
            data: { data: { ...data, genres: ['Changed'], runtime: 30 } },
        });
        await read(`/clubs/${clubId}/achievements`);
        expect(
            await api.prisma.achievementAward.findUniqueOrThrow({ where: { id: before.id } }),
        ).toEqual(before);
    });

    it('should recompute unearned progress after removal and enforce subject scope constraints', async () => {
        const userId = users[1]!;
        await api.prisma.watchlistItem.createMany({
            data: movies.slice(0, 2).map((movieId) => ({ userId, movieId, priority: 'LOW' })),
        });
        expect(
            (await read('/library/achievements', userId)).items.find(
                (item) => item.key === 'archivist',
            )!.progress,
        ).toBe(2);
        await api.prisma.watchlistItem.deleteMany({ where: { userId, movieId: movies[0] } });
        expect(
            (await read('/library/achievements', userId)).items.find(
                (item) => item.key === 'archivist',
            )!.progress,
        ).toBe(1);
        expect(
            await api.prisma.achievementAward.count({ where: { userId, key: 'archivist' } }),
        ).toBe(0);
        await read(`/clubs/${clubId}/achievements`);
        await expect(
            api.prisma.achievementAward.create({
                data: {
                    key: 'first-screening',
                    version: 1,
                    clubId,
                    title: 'Invalid award',
                    description: 'Invalid owner',
                    target: 1,
                    userId,
                    progress: 0,
                    explanation: 'invalid scope',
                    evidence: {},
                },
            }),
        ).rejects.toThrow();
    });

    it('should keep archived Club reads, mask result-derived awards for Members, and deny departure', async () => {
        const path = `/clubs/${clubId}/achievements`;
        const manager = await read(path);
        expect(manager.items.find((item) => item.key === 'cult-classic')).toMatchObject({
            status: 'unlocked',
            progress: 1,
        });
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        await addMember(api.prisma, clubId, users[1]!);
        const member = await read(path, users[1]);
        expect(member.items.find((item) => item.key === 'first-screening')!.status).toBe(
            'unlocked',
        );
        expect(member.items.find((item) => item.key === 'cult-classic')).toMatchObject({
            progress: null,
            awardedAt: null,
            status: 'not-started',
        });
        expect(JSON.stringify(member)).not.toContain('participantId');
        expect((await api.request(`${path}?scope=PERSONAL`, { userId: users[0] })).status).toBe(
            400,
        );
        await api.prisma.membership.updateMany({
            where: { clubId, userId: users[1] },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        expect((await api.request(path, { userId: users[1] })).status).toBe(404);
    });
});
