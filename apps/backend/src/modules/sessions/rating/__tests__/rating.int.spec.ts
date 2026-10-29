import { randomUUID } from 'node:crypto';

import { sessionSchema, type TSession } from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    findNotifiedUsers,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../../testing/integration.js';

describe('Rating', () => {
    let api: ITestApi;
    let users: string[];
    let clubId: string;
    let movieId: string;
    let sessionId: string;
    let memberships: string[];
    let participantIds: string[];
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 5 }, () => createUser(api.prisma)));
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Rating Club' } });
        memberships = [];
        for (const [index, role] of (
            ['ADMIN', 'MODERATOR', 'MEMBER', 'MEMBER'] as const
        ).entries()) {
            memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
        }
        movieId = (await api.prisma.movie.create({ data: { title: 'Rating screening' } })).id;
        sessionId = (
            await createSession(api.prisma, clubId, {
                type: 'PRE_SELECTED',
                phase: 'RATING',
                movieId,
            })
        ).id;
        participantIds = [];
        for (const membershipId of memberships.slice(0, 3)) {
            participantIds.push(
                (
                    await api.prisma.sessionParticipant.create({
                        data: { sessionId, clubId, membershipId, status: 'ACCEPTED' },
                    })
                ).id,
            );
        }
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
    });
    afterAll(async () => {
        await api.close();
    });
    const submit = (index = 0, json: unknown = { score: 8, comment: 'A fine screening.' }) =>
        api.request(`/sessions/${sessionId}/rating`, {
            userId: users[index],
            method: 'POST',
            json,
        });
    const close = (index = 0, json: unknown = { phaseVersion: 1, confirmation: 'CLOSE' }) =>
        api.request(`/sessions/${sessionId}/rating/close`, {
            userId: users[index],
            method: 'POST',
            json,
        });
    const state = () => api.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const received = () =>
        api.prisma.sessionRating.findMany({
            where: { sessionId },
            orderBy: { participantId: 'asc' },
        });
    const detail = async (index = 0): Promise<TSession> =>
        sessionSchema.parse(
            await (await api.request(`/sessions/${sessionId}`, { userId: users[index] })).json(),
        );

    it('should save concurrent duplicates once and complete positive N/N once', async () => {
        const duplicates = await Promise.all([submit(), submit(), submit()]);
        expect(duplicates.map((response) => response.status)).toEqual([201, 201, 201]);
        expect(duplicates[0].headers.get('cache-control')).toBe('private, no-store');
        expect(await received()).toHaveLength(1);
        expect((await submit(0, { score: 4 })).status).toBe(409);
        expect((await detail()).rating).toMatchObject({
            acceptedCount: 3,
            submittedCount: 1,
            receivedCount: 1,
            canSubmit: false,
            results: null,
            own: { score: 8 },
        });
        const final = await Promise.all([submit(1), submit(2), submit(2)]);
        expect(final.map((response) => response.status)).toEqual([201, 201, 201]);
        expect(await state()).toMatchObject({
            phase: 'COMPLETED',
            phaseVersion: 2,
            detailsVersion: 2,
            progressVersion: 4,
        });
        expect(await received()).toHaveLength(3);
        expect((await submit()).status).toBe(201);
        const events = await api.prisma.sessionProgressEvent.findMany({
            where: { sessionId, phase: 'COMPLETED' },
        });
        expect(events).toHaveLength(1);
        expect(events[0]!.kind).toBe('AUTOMATIC');
        expect(await findNotifiedUsers(api.prisma, sessionId, 'RATING_CLOSED')).toEqual(
            users.slice(0, 3).toSorted((a, b) => a.localeCompare(b)),
        );
        expect((await close()).status).toBe(201);
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_RATING_CLOSED' },
            }),
        ).toBe(0);
    });

    it('should preserve exactly the received ratings under concurrent partial closure', async () => {
        await submit(2, { score: 10, comment: '  Keep this\r\nresponse.  ' });
        const before = await received();
        const results = await Promise.all([close(), close(1), close()]);
        expect(results.map((response) => response.status)).toEqual([201, 201, 201]);
        expect(await received()).toEqual(before);
        expect(before[0]!.comment).toBe('Keep this\nresponse.');
        expect((await submit(1)).status).toBe(409);
        expect(await state()).toMatchObject({
            phase: 'COMPLETED',
            phaseVersion: 2,
            progressVersion: 3,
        });
        expect(
            await api.prisma.clubAuditEvent.count({
                where: { sessionId, action: 'SESSION_RATING_CLOSED' },
            }),
        ).toBe(1);
        expect(await findNotifiedUsers(api.prisma, sessionId, 'RATING_CLOSED')).toEqual(
            users.slice(0, 3).toSorted((a, b) => a.localeCompare(b)),
        );
        expect((await detail(2)).rating).toMatchObject({
            canSubmit: false,
            canClose: false,
            results: { average: 10, entries: [{ score: 10, comment: 'Keep this\nresponse.' }] },
        });
    });

    it('should serialize a last submission racing manual completion without losing an accepted response', async () => {
        await submit();
        await submit(1);
        const [last, closure] = await Promise.all([submit(2), close()]);
        expect(closure.status).toBe(201);
        expect([201, 409]).toContain(last.status);
        expect(await received()).toHaveLength(last.status === 201 ? 3 : 2);
        const events = await api.prisma.sessionProgressEvent.findMany({
            where: { sessionId, phase: 'COMPLETED' },
        });
        expect(events).toHaveLength(1);
        expect(await state()).toMatchObject({ phase: 'COMPLETED', phaseVersion: 2 });
    });

    it('should permit empty manual completion but never complete zero participants automatically', async () => {
        await api.prisma.sessionParticipant.updateMany({
            where: { sessionId },
            data: { status: 'LEFT' },
        });
        const joined = await api.request(`/sessions/${sessionId}/participation`, {
            userId: users[3],
            method: 'POST',
            json: { decision: 'decline' },
        });
        expect(joined.status).toBe(200);
        expect((await state()).phase).toBe('RATING');
        expect((await close(1)).status).toBe(201);
        expect(await received()).toEqual([]);
        expect((await detail()).rating?.results).toEqual({ average: null, entries: [] });
    });

    it('should retain departed responses and complete when every remaining accepted participant has rated', async () => {
        await submit();
        await submit(1);
        const leave = await api.request(`/sessions/${sessionId}/leave`, {
            userId: users[2],
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
        expect(leave.status).toBe(204);
        expect((await state()).phase).toBe('COMPLETED');
        expect(await received()).toHaveLength(2);
    });

    it('should retain a rated leaver in the results while counting only accepted participants for progress', async () => {
        await submit(2);
        const leave = await api.request(`/sessions/${sessionId}/leave`, {
            userId: users[2],
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
        expect(leave.status).toBe(204);
        expect((await detail()).rating).toMatchObject({
            acceptedCount: 2,
            submittedCount: 0,
            receivedCount: 1,
        });
        await submit();
        await submit(1);
        expect((await detail()).rating?.results?.entries).toHaveLength(3);
    });

    it('should hide other responses until completion and enforce snapshotted post-close visibility', async () => {
        await api.prisma.session.update({
            where: { id: sessionId },
            data: { showRatingResults: false },
        });
        await submit();
        await submit(2, { score: 3, comment: 'Private response' });
        expect((await detail()).rating?.results).toBeNull();
        expect((await detail(1)).rating?.own).toBeNull();
        await close();
        await api.prisma.club.update({ where: { id: clubId }, data: { showRatingResults: true } });
        for (const index of [2, 3]) {
            const session = await detail(index);
            expect(session.rating?.results).toBeNull();
            expect(JSON.stringify(session)).not.toContain('A fine screening.');
        }
        expect((await detail(2)).rating?.own?.comment).toBe('Private response');
        expect((await detail()).rating?.results?.entries).toHaveLength(2);
        expect((await detail(1)).rating?.results?.average).toBe(5.5);
    });

    it('should enforce authentication, Membership, participation and operator access including retries', async () => {
        expect(
            (
                await api.request(`/sessions/${sessionId}/rating`, {
                    method: 'POST',
                    json: { score: 8 },
                })
            ).status,
        ).toBe(401);
        expect((await submit(4)).status).toBe(404);
        expect((await submit(3)).status).toBe(403);
        expect((await close(2)).status).toBe(403);
        expect((await close(4)).status).toBe(404);
        await close();
        expect((await close(2)).status).toBe(403);
        expect((await close(4)).status).toBe(404);
    });

    it('should reject invalid input, stale versions and inactive Clubs without writes', async () => {
        for (const score of [0, 11, 1.5, '8'])
            expect((await submit(0, { score })).status).toBe(400);
        expect((await submit(0, { score: 5, comment: 'x'.repeat(2001) })).status).toBe(400);
        expect((await close(0, { phaseVersion: 1, confirmation: 'yes' })).status).toBe(400);
        expect((await close(0, { phaseVersion: 2, confirmation: 'CLOSE' })).status).toBe(409);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        expect((await submit()).status).toBe(409);
        expect((await close()).status).toBe(409);
        expect((await detail()).rating).toMatchObject({ canSubmit: false, canClose: false });
        expect(await received()).toEqual([]);
        expect((await state()).phaseVersion).toBe(1);
    });

    it('should enforce storage bounds, participant linkage and immutable responses after completion', async () => {
        const data = { sessionId, participantId: participantIds[0]!, score: 8 };
        await expect(
            api.prisma.sessionRating.create({ data: { ...data, score: 11 } }),
        ).rejects.toThrow('SessionRating_score_check');
        const other = await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'RATING',
        });
        await expect(
            api.prisma.sessionRating.create({ data: { ...data, sessionId: other.id } }),
        ).rejects.toThrow('SessionRating_participantId_sessionId_fkey');
        await submit();
        await expect(api.prisma.sessionRating.create({ data })).rejects.toThrow(
            'SessionRating_participantId_sessionId_key',
        );
        const before = await received();
        await expect(
            api.prisma.sessionRating.update({ where: { id: before[0]!.id }, data: { score: 1 } }),
        ).rejects.toThrow('Session Ratings are immutable');
        await close();
        await expect(
            api.prisma.sessionRating.update({
                where: { id: before[0]!.id },
                data: { comment: 'Rewrite history' },
            }),
        ).rejects.toThrow('Session Ratings are immutable');
        await expect(
            api.prisma.sessionRating.create({
                data: { ...data, participantId: participantIds[1]! },
            }),
        ).rejects.toThrow('Live ratings require an open Rating Session and a submission time');
        expect(await received()).toEqual(before);
    });

    it('should pause automatic completion while archived and evaluate it on reactivation', async () => {
        await submit();
        await submit(1);
        await api.prisma.club.update({ where: { id: clubId }, data: { lifecycle: 'ARCHIVED' } });
        const leave = await api.request(`/sessions/${sessionId}/leave`, {
            userId: users[2],
            method: 'POST',
            json: { confirmation: 'LEAVE' },
        });
        expect(leave.status).toBe(204);
        expect((await state()).phase).toBe('RATING');
        const reactivated = await api.request(`/clubs/${clubId}/reactivate`, {
            userId: users[0],
            method: 'POST',
            json: {},
        });
        expect(reactivated.status).toBe(204);
        expect((await state()).phase).toBe('COMPLETED');
    });

    it('should roll back manual completion when its audit write fails', async () => {
        await submit(2);
        const before = await state();
        const ratings = await received();
        await api.prisma.$executeRawUnsafe(
            `CREATE FUNCTION reject_rating_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'SESSION_RATING_CLOSED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`,
        );
        await api.prisma.$executeRawUnsafe(
            `CREATE TRIGGER reject_rating_audit BEFORE INSERT ON "ClubAuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_rating_audit()`,
        );
        try {
            expect((await close()).status).toBe(500);
            expect(await state()).toEqual(before);
            expect(await received()).toEqual(ratings);
            expect(
                await api.prisma.sessionProgressEvent.count({
                    where: { sessionId, phase: 'COMPLETED' },
                }),
            ).toBe(0);
        } finally {
            await api.prisma.$executeRawUnsafe(
                'DROP TRIGGER reject_rating_audit ON "ClubAuditEvent"',
            );
            await api.prisma.$executeRawUnsafe('DROP FUNCTION reject_rating_audit()');
        }
        expect((await close()).status).toBe(201);
    });

    it('should roll back the last rating and automatic transition if progress publication fails', async () => {
        await submit();
        await submit(1);
        const before = await state();
        await api.prisma.$executeRawUnsafe(
            `CREATE FUNCTION reject_rating_progress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase = 'COMPLETED' THEN RAISE EXCEPTION 'test progress failure'; END IF; RETURN NEW; END; $$`,
        );
        await api.prisma.$executeRawUnsafe(
            `CREATE TRIGGER reject_rating_progress BEFORE INSERT ON "SessionProgressEvent" FOR EACH ROW EXECUTE FUNCTION reject_rating_progress()`,
        );
        try {
            expect((await submit(2)).status).toBe(500);
            expect(await received()).toHaveLength(2);
            expect(await state()).toEqual(before);
        } finally {
            await api.prisma.$executeRawUnsafe(
                'DROP TRIGGER reject_rating_progress ON "SessionProgressEvent"',
            );
            await api.prisma.$executeRawUnsafe('DROP FUNCTION reject_rating_progress()');
        }
        expect((await submit(2)).status).toBe(201);
        expect((await state()).phase).toBe('COMPLETED');
    });
});
