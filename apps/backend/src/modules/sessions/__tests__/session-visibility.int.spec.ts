import { randomUUID } from 'node:crypto';

import {
    clubRatingsSchema,
    type IClubSettings,
    sessionSchema,
    type TUpdateClubSettingsRequest,
} from '@pickflick/contracts';

import {
    addMember,
    createSession,
    createUser,
    type ITestApi,
    startTestApi,
} from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';

describe('Live Club visibility', () => {
    let api: ITestApi;
    let users: string[];
    let memberships: string[];
    let clubId: string;
    let movieId: string;
    let sessionIds: string[];
    let settings: TUpdateClubSettingsRequest;

    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all(Array.from({ length: 3 }, () => createUser(api.prisma)));
        clubId = randomUUID();
        movieId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'Global visibility' } });
        memberships = [];
        for (const [index, role] of (['ADMIN', 'MODERATOR', 'MEMBER'] as const).entries()) {
            memberships.push(await addMember(api.prisma, clubId, users[index]!, role));
        }
        await api.prisma.movie.create({ data: { id: movieId, title: 'Visibility film' } });
        settings = {
            name: 'Global visibility',
            selectionScaleMin: 0,
            selectionScaleMax: 10,
            showNominationAuthorsDuring: false,
            showNominationAuthorsAfter: false,
            showSelectionScoresDuring: false,
            showSelectionScoresAfter: false,
            showRatingsDuring: false,
            showRatingsAfter: false,
            showNominationsBeforeSubmit: true,
        };
        sessionIds = [];
        for (const isLegacy of [true, false]) {
            sessionIds.push(await createRecordedSession(isLegacy));
        }
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.delete({ where: { id: movieId } });
    });
    afterAll(async () => {
        await api.close();
    });

    async function createRecordedSession(isLegacy: boolean) {
        const session = await createSession(api.prisma, clubId, {
            type: 'PAST',
            phase: 'COMPLETED',
            movieId,
            showRatingResults: true,
            showNominationAuthorsDuring: isLegacy ? null : true,
            showNominationAuthorsAfter: isLegacy ? null : true,
            showSelectionScoresDuring: isLegacy ? null : true,
            showSelectionScoresAfter: isLegacy ? null : true,
            showRatingsDuring: isLegacy ? null : true,
            showRatingsAfter: isLegacy ? null : true,
        });
        const nomination = await api.prisma.pastNomination.create({
            data: { sessionId: session.id, movieId, nominatorMembershipId: memberships[0]! },
        });
        for (const [index, membershipId] of memberships.entries()) {
            const participant = await api.prisma.sessionParticipant.create({
                data: {
                    clubId,
                    sessionId: session.id,
                    membershipId,
                    status: 'ACCEPTED',
                    attended: true,
                },
            });
            await api.prisma.sessionRating.create({
                data: {
                    sessionId: session.id,
                    participantId: participant.id,
                    score: index + 7,
                    comment: `Peer private ${index}`,
                    submittedAt: null,
                },
            });
            await api.prisma.pastSelectionScore.create({
                data: {
                    sessionId: session.id,
                    participantId: participant.id,
                    nominationId: nomination.id,
                    score: index + 1,
                },
            });
        }
        return session.id;
    }

    async function saveSettings() {
        const response = await api.expectStatus(200, `/clubs/${clubId}/settings`, {
            userId: users[0]!,
            method: 'PATCH',
            json: settings,
        });
        return (await response.json()) as IClubSettings;
    }
    async function detail(sessionId: string, index: number) {
        const response = await api.expectStatus(200, `/sessions/${sessionId}`, {
            userId: users[index]!,
        });
        return sessionSchema.parse(await response.json());
    }

    it('should apply saved global switches to legacy and existing Sessions for every role', async () => {
        const before = await api.prisma.session.findMany({ where: { clubId } });
        const saved = await saveSettings();
        expect(saved.visibility).toMatchObject({
            showRatingsAfter: false,
            showSelectionScoresAfter: false,
        });
        for (const sessionId of sessionIds) {
            for (const index of [0, 1, 2]) {
                const session = await detail(sessionId, index);
                expect(session.rating?.results).toEqual({ average: 8, entries: null });
                expect(session.rating?.own?.score).toBe(index + 7);
                expect(session.selectionScores).toBeNull();
                expect(session.nominationAuthors).toBeNull();
                expect(JSON.stringify(session)).not.toContain(`Peer private ${(index + 1) % 3}`);
                const response = await api.expectStatus(200, `/clubs/${clubId}/ratings`, {
                    userId: users[index]!,
                });
                expect(clubRatingsSchema.parse(await response.json()).items).toEqual(
                    expect.arrayContaining([expect.objectContaining({ averageRating: 8 })]),
                );
            }
        }
        const after = await api.prisma.session.findMany({ where: { clubId } });
        for (const session of after) {
            const original = before.find((row) => row.id === session.id)!;
            expect(session.progressVersion).toBe(original.progressVersion + 1);
            expect(session.showRatingsAfter).toBe(original.showRatingsAfter);
            expect(session.updatedAt).toEqual(original.updatedAt);
            expect(session.selectionScaleMax).toBe(original.selectionScaleMax);
        }
        settings.showNominationAuthorsAfter = true;
        settings.showSelectionScoresAfter = true;
        settings.showRatingsAfter = true;
        await saveSettings();
        for (const sessionId of sessionIds) {
            for (const index of [0, 1, 2]) {
                const session = await detail(sessionId, index);
                expect(session.rating?.results?.average).toBe(8);
                expect(session.selectionScores?.ballots).toHaveLength(3);
                expect(session.selectionOutcome?.source).toBe('IMPORTED');
                expect(session.selectionOutcome).toMatchObject({
                    source: 'IMPORTED',
                    nominations: [{ author: 'Test User' }],
                });
            }
        }
        settings.showRatingsAfter = false;
        settings.showSelectionScoresAfter = false;
        await saveSettings();
        expect((await detail(sessionIds[0]!, 0)).rating?.results).toEqual({
            average: 8,
            entries: null,
        });
        expect((await detail(sessionIds[1]!, 2)).selectionScores).toBeNull();
        expect(
            await api.prisma.sessionRating.count({ where: { sessionId: { in: sessionIds } } }),
        ).toBe(6);
    });

    it('should keep During ratings hidden until own submission and use After only at Completed', async () => {
        const live = await createSession(api.prisma, clubId, {
            type: 'PRE_SELECTED',
            phase: 'RATING',
            movieId,
        });
        const sessionId = live.id;
        for (const [index, membershipId] of memberships.entries()) {
            const participant = await api.prisma.sessionParticipant.create({
                data: { clubId, sessionId, membershipId, status: 'ACCEPTED' },
            });
            if (index < 2) {
                await api.prisma.sessionRating.create({
                    data: { sessionId, participantId: participant.id, score: 8 },
                });
            }
        }
        settings.showRatingsDuring = true;
        await saveSettings();
        expect((await detail(sessionId, 0)).rating?.results?.entries).toHaveLength(2);
        expect((await detail(sessionId, 2)).rating?.results).toEqual({ average: 8, entries: null });
        settings.showRatingsDuring = false;
        settings.showRatingsAfter = true;
        await saveSettings();
        expect((await detail(sessionId, 0)).rating?.results).toEqual({ average: 8, entries: null });
        await api.prisma.session.update({ where: { id: sessionId }, data: { phase: 'COMPLETED' } });
        expect((await detail(sessionId, 2)).rating?.results?.entries).toHaveLength(2);
    });

    it('should reject changes by non-Admin roles without changing disclosure', async () => {
        await saveSettings();
        for (const index of [1, 2]) {
            await api.expectStatus(403, `/clubs/${clubId}/settings`, {
                userId: users[index]!,
                method: 'PATCH',
                json: { ...settings, showRatingsAfter: true },
            });
        }
        expect((await detail(sessionIds[0]!, 2)).rating?.results).toEqual({
            average: 8,
            entries: null,
        });
    });
});
