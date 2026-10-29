import { randomUUID } from 'node:crypto';

import { HUB_HISTORY_LIMIT, type IClubHub } from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    loadIntegrationEnvironment,
    startTestApi,
} from '../../../testing/integration.js';
import { buildCanonicalDetails } from '../../../testing/movie-fixtures.js';
import { removeUsers } from '../../../testing/remove-users.js';
import { buildDetailsCacheKey } from '../../movies/catalog-cache-key.js';

describe('Club Hub projection', () => {
    let api: ITestApi;
    let admin: string;
    let member: string;
    let first: string;
    let second: string;
    let secondMembership: string;

    beforeAll(async () => {
        api = await startTestApi();
        [admin, member] = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        first = randomUUID();
        second = randomUUID();
        secondMembership = randomUUID();
        for (const [id, name, owner] of [
            [first, 'First Club', admin],
            [second, 'Second Club', member],
        ] as const) {
            await api.prisma.club.create({ data: { id, name } });
            await addMember(api.prisma, id, owner, 'ADMIN');
        }
        await api.prisma.membership.create({
            data: { id: secondMembership, clubId: second, userId: admin, role: 'MEMBER' },
        });
        await createSession(api.prisma, first, {
            type: 'FULL_CYCLE',
            phase: 'NOMINATION',
            topic: 'First Club private Session',
        });
        await createSession(api.prisma, second, {
            type: 'PAST',
            phase: 'COMPLETED',
            topic: 'Second Club private Session',
        });
    });

    afterAll(async () => {
        await removeUsers(api.prisma, [admin, member]);
        await api.close();
    });

    it('should return one Club context with its own counts and recent activity', async () => {
        const firstResponse = await api.request(`/clubs/${first}/hub`, { userId: admin });
        const secondResponse = await api.request(`/clubs/${second}/hub`, { userId: admin });
        const firstHub = (await firstResponse.json()) as IClubHub;
        const secondHub = (await secondResponse.json()) as IClubHub;

        expect(firstResponse.headers.get('cache-control')).toBe('private, no-store');
        expect(firstHub).toMatchObject({
            club: { id: first, name: 'First Club' },
            memberCount: 1,
            sessionCount: 1,
            completedSessionCount: 0,
            activeSession: { topic: 'First Club private Session' },
        });
        expect(secondHub).toMatchObject({
            club: { id: second, name: 'Second Club' },
            memberCount: 2,
            sessionCount: 1,
            completedSessionCount: 1,
            recentSessions: [{ topic: 'Second Club private Session' }],
        });
        expect(JSON.stringify(secondHub)).not.toContain('First Club private Session');
    });

    it('should retain open Rating Sessions beyond recent activity and prefer a blocking Session', async () => {
        const ratingId = randomUUID();
        const settings = await snapshotSessionSettings(api.prisma, second);
        await api.prisma.session.createMany({
            data: [
                {
                    ...(await snapshotSessionSettings(api.prisma, first)),
                    id: randomUUID(),
                    clubId: first,
                    type: 'FULL_CYCLE',
                    phase: 'RATING',
                },
                {
                    id: randomUUID(),
                    clubId: second,
                    ...settings,
                    type: 'FULL_CYCLE',
                    phase: 'RATING',
                    updatedAt: new Date('2026-01-01T00:00:00Z'),
                },
                {
                    id: ratingId,
                    clubId: second,
                    ...settings,
                    type: 'FULL_CYCLE',
                    phase: 'RATING',
                    updatedAt: new Date('2026-01-02T00:00:00Z'),
                },
                ...Array.from({ length: 5 }, () => ({
                    id: randomUUID(),
                    clubId: second,
                    ...settings,
                    type: 'PAST' as const,
                    phase: 'COMPLETED' as const,
                    updatedAt: new Date('2026-02-01T00:00:00Z'),
                })),
            ],
        });

        const firstHub = (await (
            await api.request(`/clubs/${first}/hub`, { userId: admin })
        ).json()) as IClubHub;
        const secondHub = (await (
            await api.request(`/clubs/${second}/hub`, { userId: admin })
        ).json()) as IClubHub;

        expect(firstHub.activeSession?.phase).toBe('NOMINATION');
        expect(secondHub.activeSession).toBeUndefined();
        expect(secondHub.ratingSessions).toHaveLength(2);
        expect(secondHub.ratingSessions[0]).toMatchObject({
            id: ratingId,
            phase: 'RATING',
            progressCount: 0,
            ratingAverage: null,
        });
        expect(secondHub.recentSessions).toHaveLength(5);
        expect(secondHub.recentSessions.every(({ phase }) => phase === 'COMPLETED')).toBe(true);
    });

    it('should number Call Sheets without renumbering cancellation and expose only actual film and participation data', async () => {
        const clubId = randomUUID();
        const movieId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Call Sheet Club' } });
        const ownerId = await addMember(api.prisma, clubId, admin, 'ADMIN');
        await addMember(api.prisma, clubId, member);
        await api.prisma.movie.create({
            data: { id: movieId, title: 'Canonical title', releaseYear: 2026 },
        });
        try {
            await createSession(api.prisma, clubId, {
                type: 'FULL_CYCLE',
                phase: 'CANCELLED',
                createdAt: new Date('2026-01-01Z'),
            });
            const session = await createSession(api.prisma, clubId, {
                type: 'PRE_SELECTED',
                phase: 'WATCHING',
                movieId,
                createdAt: new Date('2026-01-02Z'),
            });
            await api.prisma.sessionParticipant.create({
                data: {
                    id: randomUUID(),
                    clubId,
                    sessionId: session.id,
                    membershipId: ownerId,
                    status: 'ACCEPTED',
                },
            });
            const environment = loadIntegrationEnvironment();
            const key = buildDetailsCacheKey(
                environment.catalog.provider,
                environment.catalog.locale,
            );
            await api.prisma.movieDetailsCache.create({
                data: {
                    movieId,
                    key,
                    fetchedAt: new Date(),
                    data: buildCanonicalDetails(100, new Date().toISOString(), movieId),
                },
            });
            const ownerHub = (await (
                await api.request(`/clubs/${clubId}/hub`, { userId: admin })
            ).json()) as IClubHub;
            const memberHub = (await (
                await api.request(`/clubs/${clubId}/hub`, { userId: member })
            ).json()) as IClubHub;
            expect(ownerHub).toMatchObject({
                // The caption counts held Sessions; the cancelled one keeps only its number.
                sessionCount: 1,
                activeSession: {
                    ordinal: 2,
                    acceptedCount: 1,
                    progressCount: null,
                    canJoin: false,
                    movie: {
                        id: movieId,
                        title: 'Synthetic Movie',
                        runtime: 120,
                        genres: ['Drama'],
                        posterUrl: `/api/movies/${movieId}/poster`,
                    },
                },
            });
            expect(memberHub.activeSession?.canJoin).toBe(true);
            expect(ownerHub.members.find(({ id }) => id === ownerId)?.sessionCount).toBe(1);
            expect(ownerHub.historySessions[0]?.ordinal).toBe(1);
            expect(ownerHub.statistics).toEqual({
                sessionsWatched: 0,
                sessionsThisYear: 0,
                averageRating: null,
                totalWatchHours: null,
                topGenre: null,
                topDirector: null,
                topActor: null,
            });
            expect(JSON.stringify(ownerHub)).not.toContain('image.tmdb.org');
        } finally {
            await api.prisma.sessionParticipant.deleteMany({ where: { clubId } });
            await api.prisma.session.deleteMany({ where: { clubId } });
            await api.prisma.membership.deleteMany({ where: { clubId } });
            await api.prisma.club.delete({ where: { id: clubId } });
            await api.prisma.movieDetailsCache.deleteMany({ where: { movieId } });
            await api.prisma.movie.delete({ where: { id: movieId } });
        }
    });

    it('should hide a stale Hub after Membership removal', async () => {
        await api.prisma.membership.update({
            where: { id: secondMembership },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const response = await api.request(`/clubs/${second}/hub`, { userId: admin });

        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain('Second Club');
    });

    it('should project Rating progress and policy-filtered historical averages from received responses', async () => {
        const users = await Promise.all(Array.from({ length: 3 }, () => createUser(api.prisma)));
        const clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'History projection' } });
        try {
            const memberships = [];
            for (const [index, role] of (['ADMIN', 'MODERATOR', 'MEMBER'] as const).entries())
                memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
            const session = await createSession(api.prisma, clubId, {
                type: 'PRE_SELECTED',
                phase: 'RATING',
                showRatingResults: false,
            });
            for (const [index, membershipId] of memberships.entries()) {
                const participant = await api.prisma.sessionParticipant.create({
                    data: { sessionId: session.id, clubId, membershipId, status: 'ACCEPTED' },
                });
                if (index !== 1)
                    await api.prisma.sessionRating.create({
                        data: {
                            sessionId: session.id,
                            participantId: participant.id,
                            score: index === 0 ? 10 : 4,
                        },
                    });
                if (index === 2)
                    await api.prisma.sessionParticipant.update({
                        where: { id: participant.id },
                        data: { status: 'LEFT' },
                    });
            }
            const read = async (userId: string) =>
                (await (await api.request(`/clubs/${clubId}/hub`, { userId })).json()) as IClubHub;
            const open = await read(users[0]!);
            expect(open.activeSession).toBeUndefined();
            expect(open.ratingSessions).toMatchObject([
                { id: session.id, acceptedCount: 2, progressCount: 1, ratingAverage: null },
            ]);
            await api.prisma.session.update({
                where: { id: session.id },
                data: { phase: 'COMPLETED' },
            });
            await api.prisma.club.update({
                where: { id: clubId },
                data: { showRatingResults: true },
            });
            for (const userId of users.slice(0, 2))
                expect((await read(userId)).historySessions).toMatchObject([
                    { id: session.id, ratingAverage: 7 },
                ]);
            expect((await read(users[2]!)).historySessions).toMatchObject([
                { id: session.id, ratingAverage: null },
            ]);
            await api.prisma.membership.update({
                where: { id: memberships[1] },
                data: { role: 'MEMBER' },
            });
            expect((await read(users[1]!)).historySessions[0]?.ratingAverage).toBeNull();
            const published = await createSession(api.prisma, clubId, {
                type: 'PRE_SELECTED',
                phase: 'RATING',
                showRatingResults: true,
            });
            const participant = await api.prisma.sessionParticipant.create({
                data: {
                    sessionId: published.id,
                    clubId,
                    membershipId: memberships[0]!,
                    status: 'ACCEPTED',
                },
            });
            await api.prisma.sessionRating.create({
                data: { sessionId: published.id, participantId: participant.id, score: 9 },
            });
            await api.prisma.session.update({
                where: { id: published.id },
                data: { phase: 'COMPLETED' },
            });
            expect(
                (await read(users[2]!)).historySessions.find(({ id }) => id === published.id)
                    ?.ratingAverage,
            ).toBe(9);
        } finally {
            await removeUsers(api.prisma, users);
        }
    });

    it('should keep the average of a recent Completed Session that newer cancellations push out of history', async () => {
        const owner = await createUser(api.prisma);
        const clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Recent average' } });
        try {
            const membershipId = await addMember(api.prisma, clubId, owner, 'ADMIN');
            const completed = await createSession(api.prisma, clubId, {
                type: 'PRE_SELECTED',
                phase: 'RATING',
            });
            const participant = await api.prisma.sessionParticipant.create({
                data: { sessionId: completed.id, clubId, membershipId, status: 'ACCEPTED' },
            });
            await api.prisma.sessionRating.create({
                data: { sessionId: completed.id, participantId: participant.id, score: 8 },
            });
            await api.prisma.session.update({
                where: { id: completed.id },
                data: { phase: 'COMPLETED' },
            });
            for (let index = 0; index < HUB_HISTORY_LIMIT; index++)
                await createSession(api.prisma, clubId, { type: 'PAST', phase: 'CANCELLED' });

            const hub = (await (
                await api.request(`/clubs/${clubId}/hub`, { userId: owner })
            ).json()) as IClubHub;

            expect(hub.historySessions.map(({ id }) => id)).not.toContain(completed.id);
            expect(hub.recentSessions).toMatchObject([{ id: completed.id, ratingAverage: 8 }]);
        } finally {
            await removeUsers(api.prisma, [owner]);
        }
    });
});
