import { randomUUID } from 'node:crypto';

import { personalMovieRatingSchema, personalRatingResponseSchema } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';

describe('PersonalRating', () => {
    let api: ITestApi;
    let users: string[];
    let movieId: string;
    let sessionId: string;
    let clubId: string;
    let participantId: string;
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        movieId = (await api.prisma.movie.create({ data: { title: 'Personal rating screening' } }))
            .id;
        clubId = (
            await api.prisma.club.create({
                data: { id: randomUUID(), name: 'Personal rating club' },
            })
        ).id;
        const membershipId = await addMember(api.prisma, clubId, users[0]!, 'ADMIN');
        sessionId = (
            await createSession(api.prisma, clubId, {
                type: 'PRE_SELECTED',
                phase: 'RATING',
                movieId,
            })
        ).id;
        participantId = (
            await api.prisma.sessionParticipant.create({
                data: { sessionId, clubId, membershipId, status: 'ACCEPTED' },
            })
        ).id;
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
    });
    afterAll(async () => {
        await api.close();
    });
    const read = (index = 0) =>
        api.request(`/movies/${movieId}/personal-rating`, { userId: users[index] });
    const save = (json: unknown = { score: 6 }, index = 0) =>
        api.request(`/movies/${movieId}/personal-rating`, {
            userId: users[index],
            method: 'PUT',
            json,
        });
    const submit = (id = sessionId, score = 8) =>
        api.request(`/sessions/${id}/rating`, {
            userId: users[0],
            method: 'POST',
            json: { score },
        });
    const current = () =>
        api.prisma.personalMovieRating.findUniqueOrThrow({
            where: { userId_movieId: { userId: users[0]!, movieId } },
        });

    it('should isolate users and save one current opinion with source and update metadata', async () => {
        expect(personalRatingResponseSchema.parse(await (await read()).json())).toEqual({
            rating: null,
        });
        const duplicates = await Promise.all([save(), save(), save()]);
        expect(duplicates.map((response) => response.status)).toEqual([200, 200, 200]);
        expect(duplicates[0].headers.get('cache-control')).toBe('private, no-store');
        const rating = personalMovieRatingSchema.parse(await duplicates[0].json());
        expect(rating).toMatchObject({ score: 6, source: 'PERSONAL' });
        expect(rating.updatedAt).toBeTruthy();
        expect(await api.prisma.personalMovieRating.count({ where: { userId: users[0] } })).toBe(1);
        expect(await (await read(1)).json()).toEqual({ rating: null });
        await save({ score: 2 }, 1);
        expect(await (await read()).json()).toMatchObject({ rating: { score: 6 } });
        expect(await (await read(1)).json()).toMatchObject({ rating: { score: 2 } });
    });

    it('should sync a new Session Rating atomically and preserve all history under personal edits and retries', async () => {
        await save({ score: 3 });
        expect((await submit()).status).toBe(201);
        expect(await current()).toMatchObject({ score: 8, source: 'SESSION' });
        const history = await api.prisma.sessionRating.findMany({ where: { sessionId } });
        const session = await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
        expect(session.phase).toBe('COMPLETED');
        await save({ score: 10 });
        const edited = await current();
        expect(edited.source).toBe('PERSONAL');
        expect((await submit()).status).toBe(201);
        expect((await submit(sessionId, 1)).status).toBe(409);
        expect(await current()).toEqual(edited);
        expect(await api.prisma.sessionRating.findMany({ where: { sessionId } })).toEqual(history);
        expect(await api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } })).toEqual(
            session,
        );
        const membership = await api.prisma.membership.findFirstOrThrow({
            where: { userId: users[0], clubId },
        });
        const repeat = await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'RATING',
            movieId,
        });
        await api.prisma.sessionParticipant.create({
            data: { sessionId: repeat.id, clubId, membershipId: membership.id, status: 'ACCEPTED' },
        });
        expect((await submit(repeat.id, 5)).status).toBe(201);
        const latest = await current();
        expect(latest).toMatchObject({ score: 5, source: 'SESSION' });
        await submit();
        expect(await current()).toEqual(latest);
        expect(await api.prisma.sessionRating.findMany({ where: { sessionId } })).toEqual(history);
    });

    it('should initialize once under concurrent Session retries', async () => {
        const responses = await Promise.all([submit(), submit(), submit()]);
        expect(responses.map((response) => response.status)).toEqual([201, 201, 201]);
        expect(await current()).toMatchObject({ score: 8, source: 'SESSION' });
        expect(await api.prisma.sessionRating.count({ where: { sessionId } })).toBe(1);
        expect(await api.prisma.personalMovieRating.count({ where: { movieId } })).toBe(1);
    });

    it('should reject foreign ownership input, malformed scores, unknown Movies and unauthenticated access', async () => {
        for (const json of [
            { score: 0 },
            { score: 11 },
            { score: 1.5 },
            { score: '8' },
            { score: 8, userId: users[1] },
        ]) {
            expect((await save(json)).status).toBe(400);
        }
        await api.expectStatus(401, `/movies/${movieId}/personal-rating`);
        expect(
            (
                await api.request(`/movies/${movieId}/personal-rating`, {
                    method: 'PUT',
                    json: { score: 8 },
                })
            ).status,
        ).toBe(401);
        expect(
            (
                await api.request(`/movies/${randomUUID()}/personal-rating`, {
                    userId: users[0],
                    method: 'PUT',
                    json: { score: 8 },
                })
            ).status,
        ).toBe(404);
        await api.expectStatus(400, '/movies/invalid/personal-rating', { userId: users[0] });
        expect(
            (
                await api.request(`/sessions/${sessionId}/rating`, {
                    userId: users[1],
                    method: 'POST',
                    json: { score: 8 },
                })
            ).status,
        ).toBe(404);
        expect(await api.prisma.personalMovieRating.count({ where: { movieId } })).toBe(0);
    });

    it('should reject a screening without a Movie before writing either rating', async () => {
        await api.prisma.session.update({ where: { id: sessionId }, data: { movieId: null } });
        expect((await submit()).status).toBe(409);
        expect(await api.prisma.sessionRating.count({ where: { sessionId } })).toBe(0);
        expect(await api.prisma.personalMovieRating.count({ where: { movieId } })).toBe(0);
    });

    it('should enforce uniqueness, bounds and references in the database', async () => {
        const data = { userId: users[0]!, movieId, score: 7, source: 'PERSONAL' as const };
        await api.prisma.personalMovieRating.create({ data });
        await expect(api.prisma.personalMovieRating.create({ data })).rejects.toThrow(
            'PersonalMovieRating_pkey',
        );
        await expect(
            api.prisma.personalMovieRating.update({
                where: { userId_movieId: { userId: users[0]!, movieId } },
                data: { score: 0 },
            }),
        ).rejects.toThrow('PersonalMovieRating_score_check');
        await expect(
            api.prisma.personalMovieRating.create({ data: { ...data, userId: randomUUID() } }),
        ).rejects.toThrow('PersonalMovieRating_userId_fkey');
        await expect(
            api.prisma.personalMovieRating.create({ data: { ...data, movieId: randomUUID() } }),
        ).rejects.toThrow('PersonalMovieRating_movieId_fkey');
        expect(await current()).toMatchObject({ score: 7 });
    });

    it('should roll back the personal update when Session completion fails', async () => {
        await save({ score: 4 });
        const previous = await current();
        await api.prisma.$executeRawUnsafe(
            `CREATE FUNCTION reject_personal_progress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test completion failure'; END; $$`,
        );
        await api.prisma.$executeRawUnsafe(
            `CREATE TRIGGER reject_personal_progress BEFORE INSERT ON "SessionProgressEvent" FOR EACH ROW EXECUTE FUNCTION reject_personal_progress()`,
        );
        try {
            expect((await submit()).status).toBe(500);
            expect(await current()).toEqual(previous);
            expect(await api.prisma.sessionRating.count({ where: { participantId } })).toBe(0);
        } finally {
            await api.prisma.$executeRawUnsafe(
                'DROP TRIGGER reject_personal_progress ON "SessionProgressEvent"',
            );
            await api.prisma.$executeRawUnsafe('DROP FUNCTION reject_personal_progress()');
        }
    });
});
