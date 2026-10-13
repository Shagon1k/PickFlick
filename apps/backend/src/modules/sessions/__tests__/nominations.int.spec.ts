import { randomInt, randomUUID } from 'node:crypto';

import { sessionSchema } from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import {
    addMember,
    createSession,
    createUser,
    integrationEnvironment,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';
import { movieDetails } from '../../../testing/movie-fixtures.js';
import { MoviesRepository } from '../../movies/movies.repository.js';
import { MoviesService } from '../../movies/movies.service.js';
import type { IMovieProvider } from '../../movies/providers/movie-provider.js';

describe('Nominations', () => {
    let api: ITestApi;
    let users: string[];
    let admin: string;
    let member: string;
    let outsider: string;
    let clubId: string;
    let sessionId: string;
    let adminParticipant: string;
    let memberParticipant: string;
    let movies: string[];
    const searchKeys: string[] = [];
    beforeAll(async () => {
        api = await startTestApi();
        admin = await createUser(api.prisma);
        member = await createUser(api.prisma);
        outsider = await createUser(api.prisma);
        users = [admin, member, outsider];
        movies = [];
        for (let index = 0; index < 3; index++)
            movies.push((await api.prisma.movie.create({ data: {} })).id);
    });
    beforeEach(async () => {
        clubId = randomUUID();
        sessionId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Nomination Club' } });
        const a = await addMember(api.prisma, clubId, admin, 'ADMIN');
        const m = await addMember(api.prisma, clubId, member);
        await createSession(api.prisma, clubId, {
            id: sessionId,
            type: 'FULL_CYCLE',
            phase: 'NOMINATION',
        });
        adminParticipant = (
            await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId: a, status: 'ACCEPTED' },
            })
        ).id;
        memberParticipant = (
            await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId: m, status: 'ACCEPTED' },
            })
        ).id;
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movieSearchCache.deleteMany({ where: { key: { in: searchKeys } } });
        await api.prisma.movie.deleteMany({ where: { id: { in: movies } } });
        await api.close();
    });
    const submit = (userId = member, movieId = movies[0]) =>
        api.request(`/sessions/${sessionId}/nominations`, {
            userId,
            method: 'POST',
            json: { movieId },
        });
    const read = (userId = member) => api.request(`/sessions/${sessionId}`, { userId });
    const nominationData = (data: unknown) => sessionSchema.parse(data).nominations!;
    const close = (userId = admin, version = 1) =>
        api.request(`/sessions/${sessionId}/nominations/close`, {
            userId,
            method: 'POST',
            json: { phaseVersion: version, confirmation: 'CLOSE' },
        });
    it('should retain search metadata after submission in the Session projection without opening details', async () => {
        const record = movieDetails(randomInt(10000000, 2000000000));
        const provider: IMovieProvider = {
            configurationKey: randomUUID(),
            search: vi.fn().mockResolvedValue({
                movies: [record],
                page: 1,
                totalPages: 1,
                totalResults: 1,
            }),
            details: vi.fn(),
        };
        const environment = integrationEnvironment();
        const catalog = new MoviesService(
            provider,
            new MoviesRepository(api.prisma, environment),
            environment,
        );
        const result = await catalog.search({ query: 'Synthetic Movie', page: 1, locale: 'en-US' });
        if (result.state === 'unavailable') throw new Error('Search unavailable');
        const movieId = result.data.movies[0]!.id;
        movies.push(movieId);
        const cached = await api.prisma.movieSearchCache.findFirstOrThrow({
            where: { data: { path: ['movies'], array_contains: [{ id: movieId }] } },
        });
        searchKeys.push(cached.key);
        expect(await api.prisma.movieDetailsCache.count({ where: { movieId } })).toBe(0);
        expect(await api.prisma.movieSourceCache.count({ where: { movieId } })).toBe(0);
        expect((await submit(member, movieId)).status).toBe(201);
        const data = nominationData(await (await read()).json());
        const summary = { id: movieId, title: 'Synthetic Movie', year: 2026 };
        expect(data.ownMovie).toEqual(summary);
        expect(data.nominations).toEqual([expect.objectContaining({ movie: summary })]);
        expect(provider.details).not.toHaveBeenCalled();
    });
    it('should serialize submissions and enforce database uniqueness without service locks', async () => {
        const responses = await Promise.all([submit(), submit(member, movies[1])]);
        expect(responses.map((r) => r.status).toSorted((a, b) => a - b)).toEqual([201, 409]);
        expect(
            await api.prisma.nomination.count({ where: { participantId: memberParticipant } }),
        ).toBe(1);
        await expect(
            api.prisma.nomination.create({
                data: { sessionId, participantId: memberParticipant, movieId: movies[0]! },
            }),
        ).rejects.toMatchObject({ code: 'P2002' });
        expect(nominationData(await (await read()).json())).toMatchObject({
            acceptedCount: 2,
            nominatedCount: 1,
            canSubmit: false,
        });
    });
    it('should reject unauthenticated, nonmember, nonparticipant, invalid and unknown Movie submissions', async () => {
        expect(
            (
                await api.request(`/sessions/${sessionId}/nominations`, {
                    method: 'POST',
                    json: { movieId: movies[0] },
                })
            ).status,
        ).toBe(401);
        expect((await submit(outsider)).status).toBe(404);
        await api.prisma.sessionParticipant.update({
            where: { id: memberParticipant },
            data: { status: 'INVITED' },
        });
        expect((await submit()).status).toBe(403);
        await api.prisma.sessionParticipant.update({
            where: { id: memberParticipant },
            data: { status: 'ACCEPTED' },
        });
        expect((await submit(member, 'bad-id')).status).toBe(400);
        expect((await submit(member, randomUUID())).status).toBe(409);
        expect(await api.prisma.nomination.count({ where: { sessionId } })).toBe(0);
    });
    it('should hide nomination Movies before submission even from operators and hide author identities independently', async () => {
        await api.prisma.user.update({
            where: { id: member },
            data: { displayName: 'Private Nominator' },
        });
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { showNominationsBeforeSubmit: false, showNominationAuthors: false },
        });
        await submit();
        const response = await read(admin);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        const hidden = nominationData(await response.json());
        expect(hidden).toMatchObject({
            nominations: [],
            hidden: true,
            nominatedCount: 1,
            ownMovie: null,
        });
        expect(JSON.stringify(hidden)).not.toContain(movies[0]);
        const extra = await addMember(api.prisma, clubId, outsider);
        await api.prisma.sessionParticipant.create({
            data: { clubId, sessionId, membershipId: extra, status: 'ACCEPTED' },
        });
        await submit(admin, movies[1]);
        const visible = nominationData(await (await read(admin)).json());
        expect(visible.nominations).toHaveLength(2);
        expect(visible.nominations.every((row) => row.author === null)).toBe(true);
        expect(JSON.stringify(visible)).not.toContain('Private Nominator');
        expect(JSON.stringify(visible)).not.toContain(memberParticipant);
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { showNominationAuthors: true },
        });
        expect(nominationData(await (await read()).json()).nominations).toEqual(
            expect.arrayContaining([expect.objectContaining({ author: 'Private Nominator' })]),
        );
    });
    it('should suggest only the callers earlier losing nominations in this Club with a resolved winner', async () => {
        const membership = await api.prisma.membership.findFirstOrThrow({
            where: { clubId, userId: member },
        });
        const otherMembership = await api.prisma.membership.findFirstOrThrow({
            where: { clubId, userId: admin },
        });
        const settings = await snapshotSessionSettings(api.prisma, clubId);
        async function history(
            owner: string,
            movieId: string,
            winner: string | null,
            phase: 'COMPLETED' | 'CANCELLED' = 'COMPLETED',
            otherClub = false,
            earlier = true,
        ) {
            let historyClub = clubId;
            let membershipId = owner;
            if (otherClub) {
                historyClub = randomUUID();
                await api.prisma.club.create({ data: { id: historyClub, name: 'Other Club' } });
                membershipId = (
                    await api.prisma.membership.create({
                        data: {
                            id: randomUUID(),
                            clubId: historyClub,
                            userId: member,
                            role: 'ADMIN',
                        },
                    })
                ).id;
            }
            const session = await api.prisma.session.create({
                data: {
                    id: randomUUID(),
                    clubId: historyClub,
                    type: 'FULL_CYCLE',
                    phase,
                    movieId: winner,
                    createdAt: new Date(earlier ? '2020-01-01' : '2090-01-01'),
                    ...settings,
                },
            });
            const participant = await api.prisma.sessionParticipant.create({
                data: {
                    sessionId: session.id,
                    clubId: historyClub,
                    membershipId,
                    status: 'ACCEPTED',
                },
            });
            await api.prisma.nomination.create({
                data: { sessionId: session.id, participantId: participant.id, movieId },
            });
        }
        await history(membership.id, movies[0]!, movies[1]!);
        await history(membership.id, movies[0]!, movies[1]!);
        await history(membership.id, movies[1]!, movies[1]!);
        await history(membership.id, movies[2]!, null);
        await history(membership.id, movies[2]!, movies[1]!, 'CANCELLED');
        await history(otherMembership.id, movies[2]!, movies[1]!);
        await history(membership.id, movies[2]!, movies[1]!, 'COMPLETED', true);
        await history(membership.id, movies[2]!, movies[1]!, 'COMPLETED', false, false);
        const data = nominationData(await (await read()).json());
        expect(data.suggestions.map((movie) => movie.id)).toEqual([movies[0]]);
        expect((await submit(member, data.suggestions[0]?.id)).status).toBe(201);
        expect((await submit()).status).toBe(409);
    });
    it('should preserve departed nominations but exclude them from progress and close decisions', async () => {
        await submit();
        await api.prisma.sessionParticipant.update({
            where: { id: memberParticipant },
            data: { status: 'LEFT' },
        });
        expect(nominationData(await (await read()).json())).toMatchObject({
            acceptedCount: 1,
            nominatedCount: 0,
            canSubmit: false,
            nominations: [],
        });
        expect(await api.prisma.nomination.count({ where: { sessionId } })).toBe(1);
        expect((await close()).status).toBe(409);
    });
    it('should enforce Club restrictions and terminal phase submission locks', async () => {
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await submit()).status).toBe(409);
        expect(nominationData(await (await read()).json()).canSubmit).toBe(false);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ACTIVE' } });
        await api.prisma.session.update({ where: { id: sessionId }, data: { phase: 'CANCELLED' } });
        expect((await submit()).status).toBe(409);
    });
    it('should forbid member closure, reject zero/stale commands and serialize one-film closure with an audit', async () => {
        expect((await close(member)).status).toBe(403);
        expect((await close()).status).toBe(409);
        await submit();
        expect((await close(admin, 2)).status).toBe(409);
        await api.prisma.session.update({ where: { id: sessionId }, data: { detailsVersion: 7 } });
        const detail = sessionSchema.parse(await (await read(admin)).json());
        expect(detail).toMatchObject({ version: 7, phaseVersion: 1 });
        expect((await close(admin, detail.version)).status).toBe(409);
        const results = await Promise.all([
            close(admin, detail.phaseVersion),
            close(admin, detail.phaseVersion),
        ]);
        expect(results.map((r) => r.status).toSorted((a, b) => a - b)).toEqual([201, 409]);
        expect(await api.prisma.session.findUnique({ where: { id: sessionId } })).toMatchObject({
            phase: 'WATCHING',
            movieId: movies[0],
            phaseVersion: 2,
            detailsVersion: 8,
        });
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_NOMINATION_CLOSED' },
            }),
        ).toBe(1);
        expect((await submit(admin)).status).toBe(409);
    });
    it('should automatically open Selection with multiple nominations and keep the winner unresolved', async () => {
        await submit();
        await submit(admin, movies[1]);
        expect((await close()).status).toBe(409);
        expect(await api.prisma.session.findUnique({ where: { id: sessionId } })).toMatchObject({
            phase: 'SELECTION',
            movieId: null,
        });
    });
    it('should prevent linking a participant from another Session through a direct database write', async () => {
        const session = await createSession(api.prisma, clubId, {
            type: 'PAST',
            phase: 'COMPLETED',
        });
        await expect(
            api.prisma.nomination.create({
                data: {
                    sessionId: session.id,
                    participantId: adminParticipant,
                    movieId: movies[0]!,
                },
            }),
        ).rejects.toMatchObject({ code: 'P2003' });
    });
});
